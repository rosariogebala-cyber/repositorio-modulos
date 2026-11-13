"""Verifica el HTML generado y el build sin conectarse a la base."""
import sys
from collections import Counter
from pathlib import Path
from unittest import TestCase, main

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


class LandingQuality(TestCase):
    def test_generated_landings_have_landmarks_and_alt(self):
        for path in sorted((ROOT / "Templates").glob("*/*/index.html")):
            with self.subTest(landing=str(path.relative_to(ROOT))):
                result = server.accessible_landing(path.read_text(), path.parent.name)
                doc = html.document_fromstring(result)
                self.assertEqual(len(doc.xpath("//main")), 1)
                self.assertEqual(len(doc.xpath("//main//h1")), 1)
                self.assertFalse(doc.xpath("//img[not(normalize-space(@alt))]"))
                self.assertFalse(doc.xpath("//nav[not(@aria-label or @aria-labelledby)]"))
                self.assertTrue(doc.xpath("//a[contains(@class, 'lib-skip-link')]"))
                self.assertFalse([key for key, n in Counter(doc.xpath("//@id")).items() if n > 1])

    def test_existing_variants_are_used_without_overwriting_sizes(self):
        node = html.fromstring('<main><img src="/maquetas/img/gal-living.jpg" sizes="50vw"></main>')
        server.add_local_responsive_images(node)
        photo = node.find("img")
        self.assertIn("480w", photo.get("srcset"))
        self.assertIn("752w", photo.get("srcset"))
        self.assertEqual(photo.get("sizes"), "50vw")

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

    def test_public_build_keeps_panel_private(self):
        public = ROOT / "public"
        for path in ("maquetas/constructor.html", "maquetas/landings.html", "data/reglas.json", "data/db.json"):
            self.assertFalse((public / path).exists(), path)
        self.assertTrue((public / "maquetas/css/lanzate.css").is_file())

    def test_landing_lists_omit_editable_payloads(self):
        self.assertNotIn("l.items,", server.LANDING_SUMMARY_SELECT)
        self.assertIn("jsonb_array_length(l.items)", server.LANDING_SUMMARY_SELECT)
        self.assertIn("left(l.portada, 5)", server.LANDING_SUMMARY_SELECT)


if __name__ == "__main__":
    main()
