"""Pruebas de seguridad y salida de identidad para el asistente de referencias."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class ReferenceAssistantTests(unittest.TestCase):
    def setUp(self):
        self.clients = [{"id": 1, "nombre": "Estudio", "rubro": "bienestar", "sitio": ""}]
        self.base = {"cliente_id": 1, "nombre": "Landing principal",
                     "instagram": "https://www.instagram.com/estudio/",
                     "informacion": "Clases de pilates y horarios por confirmar.", "imagenes": []}
        self.response = {"colores": {"marca": "#ABCDEF", "titulo": "#112233", "texto": "#334455"},
                         "tipografia": "editorial", "rubro": "bienestar",
                         "titulo": "Estudio Pilates", "descripcion": "Clases de pilates",
                         "datos_visibles": ["Clases de pilates"]}
    def test_prepara_paleta_sin_visitar_instagram(self):
        with patch.object(server, "read_data", return_value=self.clients), patch.object(
                server, "ia_call", return_value=self.response) as model:
            result = server.ia_identidad_referencias(dict(self.base))
        self.assertEqual(result["colores"]["marca"], "#abcdef")
        self.assertEqual(result["tipografia"], "editorial")
        self.assertEqual(result["rubro"], "bienestar")
        self.assertIn("no se consultaron", result["advertencias"][0])
        self.assertIn("NO ACCEDIDOS", model.call_args.args[1])
        self.assertIsNone(model.call_args.args[2])

    def test_url_sola_no_equivale_a_lectura(self):
        payload = dict(self.base, informacion="")
        with patch.object(server, "read_data", return_value=self.clients):
            with self.assertRaises(server.ApiError):
                server.ia_identidad_referencias(payload)

    def test_no_admite_url_insegura_ni_cliente_falso(self):
        with patch.object(server, "read_data", return_value=self.clients):
            with self.assertRaises(server.ApiError):
                server.ia_identidad_referencias(dict(self.base, sitio="http://ejemplo.com"))
            with self.assertRaises(server.ApiError):
                server.ia_identidad_referencias(dict(self.base, cliente_id=999))

    def test_plan_por_landing_y_retrocompatibilidad(self):
        catalog = {"planes": [
            {"id": "express", "nombre": "Express", "secciones": 4, "turnos": False},
            {"id": "pro", "nombre": "Pro", "secciones": 10, "turnos": True}
        ]}
        client = {"id": 1, "nombre": "Estudio", "slug": "estudio", "plan": "express"}
        old = {"id": 10, "cliente_id": 1}
        new = {"id": 11, "cliente_id": 1, "plan_id": "pro",
               "plan_condiciones": dict(catalog["planes"][1])}
        with patch.object(server, "read_data", return_value=catalog):
            self.assertEqual(server.landing_plan(old, client)["id"], "express")
            self.assertEqual(server.landing_plan(new, client)["id"], "pro")
            sections = [{"id": "servicios-simple"} for _ in range(6)]
            self.assertTrue(server.plan_errors(client, sections, landing=old))
            self.assertFalse(server.plan_errors(client, sections, landing=new))
            self.assertEqual(server.landing_dict(new | {"nombre":"Landing", "slug":"landing",
                "creado":1, "actualizado":1,"items":sections}, client)["secciones_incluidas"], 10)

    def test_cupos_de_pedidos_aislados_por_sitio(self):
        plan = {"id":"express", "nombre":"Express", "secciones":4,
                "cambiosPorMes":10, "cambiosAsistidos":1}
        client = {"plan":"express", "pedidos":[
            {"fecha": server.now_ms(), "landing_slug":"a", "origen":"cliente", "estado":"pendiente"},
            {"fecha": server.now_ms(), "landing_slug":"b", "origen":"cliente", "estado":"pendiente"}]}
        with patch.object(server, "read_data", return_value={"planes":[plan]}):
            a = server.plan_status(client, {"slug":"a", "plan_id":"express"})
            b = server.plan_status(client, {"slug":"b", "plan_id":"express"})
        self.assertEqual(a["cambios_usados"], 1)
        self.assertEqual(b["cambios_usados"], 1)
        self.assertEqual(a["cambios_restantes"], 9)
        self.assertEqual(b["cambios_restantes"], 9)

    def test_descarta_html_y_estilos_no_admitidos(self):
        response = dict(self.response, titulo="<script>malicioso</script>",
                        rubro="no-existe", tipografia="fuente-externa",
                        colores={"marca":"url(javascript:alert(1))"})
        result = server.validate_brand_reference_response(response)
        self.assertEqual(result["titulo"], "")
        self.assertEqual(result["tipografia"], "moderna")
        self.assertEqual(result["rubro"], "servicios")
        self.assertEqual(result["colores"]["marca"], "#1b5e42")


if __name__ == "__main__":
    unittest.main()
