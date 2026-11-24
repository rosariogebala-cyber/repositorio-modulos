"""Pruebas puras para estados de cobro. No acceden a pagos reales ni a GitHub."""
import datetime as dt
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gestion_clientes as g


class CommercialLogicTest(unittest.TestCase):
    def setUp(self):
        self.contract = {"inicio": "2026-10-10", "dia_vencimiento": 15,
                         "abono_centavos": 1990050, "moneda": "ARS"}

    def test_no_contract_never_counts_as_paid(self):
        self.assertEqual(g.payment_status({}, [], dt.date(2026, 11, 23))["estado"], "sin_configurar")

    def test_due_and_overdue(self):
        self.assertEqual(g.payment_status(self.contract, [], dt.date(2026, 11, 15))["estado"], "pendiente")
        self.assertEqual(g.payment_status(self.contract, [], dt.date(2026, 11, 16))["estado"], "vencido")

    def test_full_and_partial_payments(self):
        entries = [{"periodo": "2026-11", "moneda":"ARS", "monto_centavos": 1000000}]
        self.assertEqual(g.payment_status(self.contract, entries, dt.date(2026, 11, 23))["estado"], "parcial")
        entries.append({"periodo":"2026-11", "moneda":"ARS", "monto_centavos": 990050})
        self.assertEqual(g.payment_status(self.contract, entries, dt.date(2026, 11, 23))["estado"], "pagado")
        self.assertEqual(g.payment_status(self.contract, entries, dt.date(2026, 12, 23))["estado"], "vencido")

    def test_other_currency_or_month_not_mixed(self):
        entries = [{"periodo":"2026-10","moneda":"ARS","monto_centavos":1990050},
                   {"periodo":"2026-11","moneda":"USD","monto_centavos":1990050}]
        self.assertEqual(g.payment_status(self.contract, entries, dt.date(2026, 11, 23))["estado"], "vencido")

    def test_payment_before_contract_start(self):
        self.contract["inicio"] = "2026-12-01"
        self.assertEqual(g.payment_status(self.contract, [], dt.date(2026, 11, 23))["estado"], "no_iniciado")

    def test_validations(self):
        for invalid in ("2026-02-30", "2026-13-01", "ayer", "2026-1-1"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                g.iso_date(invalid, required=True)
        for invalid in ("abc", "-1", "NaN", "Infinity"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                g.money_cents(invalid)
        self.assertEqual(g.money_cents("19900.50"), 1990050)


if __name__ == "__main__":
    unittest.main(verbosity=2)
