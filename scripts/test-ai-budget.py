#!/usr/bin/env python3
"""Pruebas de presupuesto de IA sin proveedor ni Redis externos."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ai_budget


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_local = ai_budget.LOCAL
        ai_budget.LOCAL = Path(self.tmp.name) / "budget.json"
        self.env = patch.dict(os.environ, {"VERCEL": ""})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        ai_budget.LOCAL = self.old_local
        self.tmp.cleanup()

    def test_presupuesto_y_alerta(self):
        for _ in range(4):
            ai_budget.begin("s", "p", None)
        self.assertTrue(ai_budget.status()["alerta"])
        self.assertEqual(ai_budget.status()["consumo_reservado_usd"], 1)
        for _ in range(4):
            ai_budget.begin("s", "p", None)
        self.assertTrue(ai_budget.status()["bloqueada"])
        with self.assertRaises(ai_budget.BudgetError):
            ai_budget.begin("s", "p", None)

    def test_liberar_reserva_en_error(self):
        r = ai_budget.begin("s", "p", None)
        ai_budget.abort(r)
        self.assertEqual(ai_budget.status()["disponible_usd"], 2)

    def test_finalizar_con_uso(self):
        r = ai_budget.begin("s", "p", None)
        ai_budget.finish(r, {"input_tokens": 100, "output_tokens": 50}, "anthropic")
        self.assertEqual(ai_budget.status()["consumo_reservado_usd"], 0.01)

    def test_cache_reutiliza_resultados(self):
        key, result = ai_budget.cached("anthropic", "modelo", "s", "p", None)
        self.assertIsNone(result)
        ai_budget.cache_result(key, {"modulos": ["hero"]})
        new_key, value = ai_budget.cached("anthropic", "modelo", "s", "p", None)
        self.assertEqual(new_key, key)
        self.assertEqual(value, {"modulos": ["hero"]})
        self.assertEqual(ai_budget.status()["consumo_reservado_usd"], 0)

    def test_texto_excesivo_es_rechazado(self):
        with self.assertRaises(ai_budget.BudgetError):
            ai_budget.begin("s", "x" * (ai_budget.MAX_TEXT_CHARS + 1), None)
        self.assertEqual(ai_budget.status()["consumo_reservado_usd"], 0)


if __name__ == "__main__":
    unittest.main()
