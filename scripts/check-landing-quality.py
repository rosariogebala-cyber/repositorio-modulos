"""Verifica las landings estáticas de l/, los archivos de data/ y las páginas del panel."""
import os
import sys
from collections import Counter
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# Siempre con los archivos del disco: aunque haya un token de GitHub en la máquina, el test no lee ni toca GitHub.
for name in ("GITHUB_TOKEN", "GH_TOKEN", "VERCEL"):
    os.environ.pop(name, None)
import server


class LandingQuality(TestCase):
    def test_builder_workflow_dialogs_have_accessible_names_and_instructions(self):
        doc = html.parse(str(ROOT / "maquetas" / "constructor.html"))
        for name in ("structure", "compare"):
            with self.subTest(dialog=name):
                dialog = doc.xpath("//dialog[@data-lb-%s]" % name)
                self.assertEqual(len(dialog), 1)
                modal = dialog[0]
                heading_id = modal.get("aria-labelledby")
                help_id = modal.get("aria-describedby")
                self.assertTrue(heading_id and help_id)
                self.assertEqual(len(modal.xpath(".//*[@id=$value and self::h2 and @tabindex='-1']",
                                                 value=heading_id)), 1)
                self.assertEqual(len(modal.xpath(".//*[@id=$value]", value=help_id)), 1)
        for attr in ("data-lb-draft-preview", "data-lb-review", "data-lb-approve",
                     "data-lb-publish-one", "data-lb-qa-review", "data-lb-discard"):
            self.assertEqual(len(doc.xpath("//button[@%s]" % attr)), 1, attr)

    def test_structure_reorder_restores_focus_and_is_announced(self):
        """Prueba estática de la implementación: el test dinámico requiere navegador real."""
        script = (ROOT / "maquetas" / "js" / "constructor.js").read_text(encoding="utf-8")
        css = (ROOT / "maquetas" / "css" / "lanzate.css").read_text(encoding="utf-8")
        self.assertIn("function render(focusEntry, focusAction)", script)
        self.assertIn("render(entry, \"up\")", script)
        self.assertIn("render(entry, \"down\")", script)
        self.assertIn("render(entry, \"variant\")", script)
        self.assertIn("target && !target.disabled", script)
        self.assertIn("Orden o selección actualizados.", script)
        self.assertIn("outline: 3px solid #4935b5", css)
        self.assertIn(".lb-structure-list button { min-width:44px; }", css)

    def test_vercel_preview_is_read_only_by_default(self):
        """Nunca se puede mutar el repositorio real desde un Preview no aislado."""
        with patch.object(server, "ON_VERCEL", True), patch.dict(os.environ, {"VERCEL_ENV": "preview"}, clear=False):
            os.environ.pop("LANZATE_PREVIEW_SANDBOX", None)
            for name in ("borradores", "borrador", "revision", "aprobar", "publicar-landing",
                         "publicar", "landing", "cliente"):
                with self.subTest(route=name), self.assertRaises(server.ApiError) as error:
                    server.Handler.handle_route(None, "POST", name, 1, {})
                self.assertEqual(error.exception.status, 403)

    def test_generated_landings_have_landmarks_and_alt(self):
        for path in sorted((ROOT / "l").glob("*/*/index.html")):
            with self.subTest(landing=str(path.relative_to(ROOT))):
                result = server.accessible_landing(path.read_text(), path.parent.name)
                doc = html.document_fromstring(result)
                self.assertEqual(len(doc.xpath("//main")), 1)
                self.assertEqual(len(doc.xpath("//main//h1")), 1)
                self.assertFalse(doc.xpath("//img[not(normalize-space(@alt))]"))
                self.assertFalse(doc.xpath("//nav[not(@aria-label or @aria-labelledby)]"))
                self.assertTrue(doc.xpath("//a[contains(@class, 'lib-skip-link')]"))
                self.assertFalse([key for key, n in Counter(doc.xpath("//@id")).items() if n > 1])

    def test_sections_and_panels_have_accessible_structure(self):
        pages = [ROOT / "index.html", *sorted((ROOT / "maquetas").glob("*.html")),
                 *sorted((ROOT / "Proyectos").glob("*/index.html"))]
        for path in pages:
            with self.subTest(page=str(path.relative_to(ROOT))):
                doc = html.parse(str(path))
                active = doc.xpath("//main[not(@hidden)]")
                self.assertEqual(len(active), 1)
                if path.name != "cliente.html":
                    self.assertEqual(len(active[0].xpath(".//h1")), 1)
                self.assertFalse(doc.xpath("//img[not(normalize-space(@alt))]"))
                self.assertFalse(doc.xpath("//nav[not(@aria-label or @aria-labelledby)]"))
                self.assertFalse([key for key, count in Counter(doc.xpath("//@id")).items() if count > 1])
                self.assertIn("#" + active[0].get("id"), doc.xpath("//a[normalize-space(.)='Saltar al contenido']/@href"))

    def test_existing_variants_are_used_without_overwriting_sizes(self):
        node = html.fromstring('<main><img src="/maquetas/img/gal-living.jpg" sizes="50vw"></main>')
        server.add_local_responsive_images(node)
        photo = node.find("img")
        self.assertIn("480w", photo.get("srcset"))
        self.assertIn("752w", photo.get("srcset"))
        self.assertEqual(photo.get("sizes"), "50vw")

    def test_site_config_strings_with_commas_and_colons_are_kept(self):
        import json
        parsed = json.loads(server.js_literal_to_json('{planes: [{id: "pro", incluye: "Diseño, hosting: 1 año",},], // nota\n}'))
        self.assertEqual(parsed["planes"][0]["incluye"], "Diseño, hosting: 1 año")

    def test_out_of_plan_note_counts_each_landing_separately(self):
        client = {"plan": "x", "plan_condiciones": {"id": "x", "nombre": "X", "cambiosPorMes": 1},
                  "pedidos": [{"fecha": server.now_ms(), "estado": "pendiente", "origen": "cliente", "landing_slug": "a"}]}
        self.assertEqual(server.request_plan_note(client, {"slug": "a"}), "fuera del límite del plan")
        self.assertEqual(server.request_plan_note(client, {"slug": "b"}), "")
        with self.assertRaises(server.ApiError):
            server.request_plan_note(dict(client, estado="pausado"), {"slug": "b"})

    def test_pending_requests_are_never_trimmed(self):
        requests = [{"id": n, "estado": "pendiente" if n < 3 else "aceptado"} for n in range(100)]
        kept = server.trim_requests(requests)
        self.assertEqual(len(kept), 80)
        self.assertEqual([r["id"] for r in kept[:3]], [0, 1, 2])
        self.assertEqual(len(server.trim_requests([{"estado": "pendiente"}] * 90)), 90)

    def test_seo_title_never_uses_internal_names(self):
        self.assertEqual(server.seo_title({"nombre": "Template agencia de viajes"}, {"nombre": "Rumbo", "rubro": "viajes"}), "Rumbo · Viajes")
        self.assertEqual(server.seo_title({"nombre": "yoga (copia)"}, {"nombre": "Aurora"}), "Aurora")
        self.assertEqual(server.seo_title({"nombre": "Clases de yoga"}, {"nombre": "Aurora"}), "Clases de yoga · Aurora")

    def test_missing_alt_is_not_filled_with_a_generic_word(self):
        node = html.fromstring('<main><img src="/maquetas/img/gal-living.jpg"></main>')
        server.fill_image_alts(node)
        self.assertEqual(node.find("img").get("alt"), "")

    def test_publication_validation_rejects_missing_structure(self):
        self.assertTrue(server.published_structure_errors("<body><p>Sin encabezado</p></body>"))
        self.assertFalse(server.published_structure_errors("<main><h1>Servicios</h1></main>"))

    def test_primary_button_color_meets_contrast_against_white(self):
        for color in ("#ffffff", "#eab879", "#ff0000", "#302060"):
            with self.subTest(color=color):
                adjusted = server.accessible_button_color(color)
                rgb = [int(adjusted[index:index + 2], 16) / 255 for index in (1, 3, 5)]
                linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
                          for value in rgb]
                luminance = sum(weight * value for weight, value in zip((0.2126, 0.7152, 0.0722), linear))
                self.assertGreaterEqual(1.05 / (luminance + 0.05), 4.5)

    def test_static_landings_use_relative_paths(self):
        for path in sorted((ROOT / "l").glob("*/*/index.html")):
            with self.subTest(landing=str(path.relative_to(ROOT))):
                text = path.read_text()
                self.assertNotRegex(text, r"""["'(\s,=]/(?:maquetas|assets|api)/""")
                self.assertNotIn("/api/", text)

    def test_relative_paths(self):
        out = server.relative_paths('<img src="/maquetas/a.jpg" srcset="/maquetas/a-480.webp 480w, /maquetas/a.jpg 800w">'
                                    '<a href="https://x.com/maquetas/">x</a><div style="background:url(&quot;/assets/b.png&quot;)">', 3)
        self.assertIn('src="../../../maquetas/a.jpg"', out)
        self.assertIn(", ../../../maquetas/a.jpg 800w", out)
        self.assertIn("https://x.com/maquetas/", out)
        self.assertIn("&quot;../../../assets/b.png", out)

    def test_data_files_load(self):
        for key in ("clientes", "landings", "planes", "config"):
            with self.subTest(archivo=key):
                if (ROOT / "data" / server.DATA_FILES[key][0]).exists():
                    self.assertIsNotNone(server.read_data(key, None))

    def test_private_data_not_in_public_repo(self):
        """Clientes, landings y fotos de pedidos van al repo privado lanzate-datos, nunca a este (es público)."""
        for rel in ("data/clientes.js", "data/landings.js", "pedidos"):
            with self.subTest(archivo=rel):
                self.assertFalse((ROOT / rel).exists(), "%s tiene que estar en lanzate-datos" % rel)
        self.assertEqual(server.data_repo("clientes"), "datos")
        self.assertEqual(server.data_repo("landings"), "datos")

    def test_site_config_parses(self):
        sample = """window.SITE = {
  marca: "Lanzate", // comentario
  /* bloque */ url: "https://a.b/c",
  planes: [{ id: "pro", incluye: ["10 cambios por mes",], },],
};"""
        start = sample.find("{")
        import json
        data = json.loads(server.js_literal_to_json(sample[start:sample.rfind("}") + 1]))
        self.assertEqual(data["url"], "https://a.b/c")
        self.assertEqual(data["planes"][0]["id"], "pro")


if __name__ == "__main__":
    main()
