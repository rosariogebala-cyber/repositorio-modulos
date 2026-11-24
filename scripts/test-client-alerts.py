"""Alertas operativas reproducibles; no requieren claves ni clientes reales."""
import sys
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import client_management as cm  # noqa: E402


class ClientAlertTests(unittest.TestCase):
    def setUp(self):
        self.zone = ZoneInfo("America/Argentina/Buenos_Aires")
        self.today = date(2026, 11, 24)
        self.now = int(datetime(2026, 11, 24, 12, tzinfo=self.zone).timestamp() * 1000)
        self.client = {"id": 7, "nombre": "Cliente Prueba", "pedidos": []}
        self.info = {"proximo_contacto": "", "movimientos": []}

    def alerts(self):
        return cm.followup_alerts(self.client, self.info, self.today, self.now, self.zone)

    def payment(self, state, due, ident=1):
        return {"id": ident, "estado": state, "vencimiento": due,
                "concepto": "Abono", "moneda": "ARS", "importe_centavos": 1990000}

    def test_no_inventar_alertas_por_falta_de_datos(self):
        self.assertEqual(self.alerts(), [])
        self.info["movimientos"].append(self.payment("pagado", "2026-11-18"))
        self.assertEqual(self.alerts(), [])

    def test_vence_ayer_hoy_y_proximos_siete_dias(self):
        self.info["movimientos"] = [
            self.payment("pendiente", "2026-11-20", 1),
            self.payment("pendiente", "2026-11-24", 2),
            self.payment("pendiente", "2026-12-01", 3),
            self.payment("pendiente", "2026-12-02", 4),
            self.payment("anulado", "2026-11-18", 5)]
        self.assertEqual([(a["tipo"], a["prioridad"]) for a in self.alerts()],
                         [("pago", 0), ("pago", 1), ("pago", 3)])
        self.assertTrue(all(a["cliente_id"] == 7 for a in self.alerts()))

    def test_pedido_mas_de_48_horas_y_cambio_cerrado(self):
        self.client["pedidos"] = [
            {"id": "older", "estado": "pendiente", "fecha": self.now - 50 * 3600 * 1000,
             "landing": "Inicio"},
            {"id": "new", "estado": "pendiente", "fecha": self.now - 2 * 3600 * 1000},
            {"id": "closed", "estado": "aceptado", "fecha": self.now - 90 * 3600 * 1000}]
        notices = self.alerts()
        self.assertEqual(len(notices), 2)
        self.assertEqual(notices[0]["titulo"], "Solicitud demorada")
        self.assertEqual(notices[1]["titulo"], "Solicitud de cambios pendiente")

    def test_proximo_contacto_registrado(self):
        self.info["proximo_contacto"] = "2026-11-24"
        self.assertEqual(self.alerts()[0]["titulo"], "Seguimiento de hoy")
        self.info["proximo_contacto"] = "2026-12-02"
        self.assertEqual(self.alerts(), [])
        self.info["proximo_contacto"] = "2026-11-22"
        self.assertEqual(self.alerts()[0]["titulo"], "Seguimiento atrasado")


if __name__ == "__main__":
    unittest.main()
