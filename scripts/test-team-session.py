"""Verifica expiración fija de 6 horas del acceso del equipo, sin cambiar el portal de clientes."""
import hashlib
import hmac
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class TeamSessionTests(unittest.TestCase):
    def test_dura_seis_horas_sin_renovacion(self):
        start = 1800000000
        with patch.object(server.time, "time", return_value=start):
            token = server.make_session()
            self.assertTrue(server.valid_session(token))
        with patch.object(server.time, "time", return_value=start + 21599):
            self.assertTrue(server.valid_session(token))
        with patch.object(server.time, "time", return_value=start + 21600):
            self.assertFalse(server.valid_session(token))
        with patch.object(server.time, "time", return_value=start + 21601):
            self.assertFalse(server.valid_session(token))

    def test_cookie_firmada_y_con_limite_de_duracion(self):
        start = 1800000000
        with patch.object(server.time, "time", return_value=start):
            token = server.make_session()
        fields = token.split(".")
        self.assertEqual(fields[:3], ["v2", str(start), str(start + 21600)])
        with patch.object(server.time, "time", return_value=start + 10):
            self.assertFalse(server.valid_session(token + "a"))
            invalid_payload = "v2.%d.%d" % (start, start + 86400)
            extended = invalid_payload + "." + hmac.new(
                server.session_secret(), invalid_payload.encode(), hashlib.sha256
            ).hexdigest()
            self.assertFalse(server.valid_session(extended))

    def test_sesion_antigua_no_sigue_abierta(self):
        start = 1800000000
        old_expiry = str(start + 30 * 86400)
        old_token = old_expiry + "." + hmac.new(
            server.session_secret(), old_expiry.encode(), hashlib.sha256
        ).hexdigest()
        with patch.object(server.time, "time", return_value=start):
            self.assertFalse(server.valid_session(old_token))

    def test_portal_cliente_no_cambia(self):
        with patch.object(server.time, "time", return_value=1800000000):
            token = server.portal_token(123, 2)
        self.assertEqual(int(token.split(".")[1]), 1800000000 + 30 * 86400)


if __name__ == "__main__":
    unittest.main()
