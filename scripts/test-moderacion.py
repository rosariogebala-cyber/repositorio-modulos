"""Regresiones del moderador automático, sin publicar ni tocar clientes reales."""
import unittest
from unittest.mock import patch
import server
from moderacion_lanzate import evaluar_cambio


class ModeracionTests(unittest.TestCase):
    def test_rechaza_pruebas_groserias_y_codigo(self):
        for value in ("XXXXXX", "Loren lorem ipsum pendiente", "hola pelotudo",
                      "<script>alert(1)</script>", "!!!!!"):
            with self.subTest(value=value):
                decision, reason = evaluar_cambio({"tipo": "texto", "despues": value})
                self.assertEqual(decision, "rechazar", reason)

    def test_textos_comerciales_validos(self):
        for value in ("Conocé nuestros servicios", "Tu próximo hogar", "Reservá tu turno"):
            with self.subTest(value=value):
                self.assertEqual(evaluar_cambio({"tipo": "texto", "despues": value})[0], "aceptar")

    def test_los_links_externos_y_fotos_se_revisan(self):
        self.assertEqual(evaluar_cambio({"tipo": "link", "despues": "https://otrodominio.com"})[0], "revisar")
        self.assertEqual(evaluar_cambio({"tipo": "link", "despues": "javascript:alert(1)"})[0], "rechazar")
        self.assertEqual(evaluar_cambio({"tipo": "foto", "despues": ""})[0], "revisar")

    def test_sin_ia_configurada_no_se_bloquea_lo_simple(self):
        rows = [{"tipo": "texto", "despues": "Servicios profesionales"}]
        results = [evaluar_cambio(rows[0])]
        with patch.object(server, "ia_settings", return_value={"clave": ""}):
            self.assertEqual(server.moderar_textos_ia(rows, results)[0][0], "aceptar")

    def test_si_ia_falla_no_aprueba_por_defecto(self):
        rows = [{"tipo": "texto", "despues": "Servicios profesionales"}]
        with patch.dict(server.os.environ, {"LANZATE_MODERACION_IA": "1"}):
            with patch.object(server, "ia_settings", return_value={"clave": "test"}):
                with patch.object(server, "ia_call", side_effect=server.ApiError(502, "error")):
                    results = server.moderar_textos_ia(rows, [("aceptar", "")])
        self.assertEqual(results[0][0], "revisar")

    def test_decision_de_ia_de_baja_confianza_se_revisa(self):
        rows = [{"tipo": "texto", "despues": "Servicios profesionales"}]
        response = {"resultados": [{"indice": 0, "decision": "aceptar", "confianza": 0.55, "motivo": "duda"}]}
        with patch.dict(server.os.environ, {"LANZATE_MODERACION_IA": "1"}):
            with patch.object(server, "ia_settings", return_value={"clave": "test"}):
                with patch.object(server, "ia_call", return_value=response):
                    results = server.moderar_textos_ia(rows, [("aceptar", "")])
        self.assertEqual(results[0][0], "revisar")


if __name__ == "__main__":
    unittest.main()
