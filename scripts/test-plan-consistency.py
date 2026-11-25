"""Regresiones: precios y cupos del sitio comercial frente al constructor."""
import json
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server

def read_window(path):
    source = (ROOT / path).read_text(encoding="utf-8")
    return json.loads(source[source.index("{"):source.rfind("}")+1])

class PlanConsistency(unittest.TestCase):
    def test_catalogo_comercial_actual(self):
        plans = {p["id"]:p for p in read_window("data/planes.js")["planes"]}
        expected = {
            "express": (99000, 29900, 4, 10, 1, False),
            "negocio": (179000, 49900, 7, 30, 3, False),
            "pro": (299000, 79900, 10, 0, 5, True),
        }
        self.assertEqual(set(plans), set(expected))
        for key, (initial, monthly, sections, sends, assisted, unlimited) in expected.items():
            with self.subTest(plan=key):
                p=plans[key]
                self.assertEqual((p["inicial"], p["mensual"], p["secciones"],
                                  p["cambiosPorMes"], p["cambiosAsistidos"],
                                  p["enviosIlimitados"]),
                                 (initial, monthly, sections, sends, assisted, unlimited))
                self.assertFalse(p["turnos"], "Los turnos a medida se cotizan aparte")

    def test_contador_biblioteca_y_recuento(self):
        source=(ROOT / "data/modules.js").read_text(encoding="utf-8")
        modules=json.loads(source[source.index("["):source.rfind("]")+1])
        self.assertEqual(len(modules), 26)
        self.assertEqual(sum(len(m["variantes"]) for m in modules), 76)
        index=(ROOT / "index.html").read_text(encoding="utf-8")
        app=(ROOT / "js/app.js").read_text(encoding="utf-8")
        self.assertIn("26 secciones · 76 propuestas", index)
        self.assertIn("mostrados.reduce(", app)
        self.assertNotIn("mostrados.length*3", app)

    def test_sincronizacion_no_confunde_cupos(self):
        site={"planes":[{"id":s,"nombre":s,"para":"", "inicial":1,"mensual":2,"incluye":[]}
                        for s in ("express","negocio","pro")],
              "comparar":[["Secciones","Hasta 4","Hasta 7","Hasta 10"],
                         ["Envíos de cambios desde tu portal / mes","10","30","Ilimitados"],
                         ["Cambios asistidos por mes","1","3","5"],
                         ["Gestión de turnos a medida","Adicional","Adicional","Adicional"],
                         ["Analítica","Básica","Básica","Ampliada"]]}
        fake="window.SITE = "+json.dumps(site,ensure_ascii=False)+";"
        with patch.object(server.FILES,"has",return_value=True),patch.object(server,"read_text",return_value=fake):
            result=server.site_plans()["planes"]
        self.assertEqual([p["cambiosPorMes"] for p in result],[10,30,0])
        self.assertEqual([p["cambiosAsistidos"] for p in result],[1,3,5])
        self.assertEqual([p["enviosIlimitados"] for p in result],[False,False,True])
        self.assertEqual([p["turnos"] for p in result],[False]*3)

    def test_secciones_adicionales_son_avisos_no_bloqueos(self):
        plan={"nombre":"Express", "secciones":4, "turnos":False}
        def items(count):
            return [{"id":"servicios-simple"} for _ in range(count)]
        with patch.object(server, "client_plan", return_value=plan):
            self.assertEqual(server.plan_errors({}, items(4)), [])
            aviso = server.plan_errors({}, items(6))
            self.assertEqual(len(aviso), 1)
            self.assertIn("2 adicionales", aviso[0])
            # La advertencia no impide guardar; la validación técnica sigue separada.
            self.assertIn("presupuesto", aviso[0])
            self.assertEqual(server.plan_errors({}, items(6), items(6)), aviso)

    def test_turnos_son_adicionales_y_no_se_eliminan_de_sitios(self):
        plan={"nombre":"Express", "secciones":4, "turnos":False}
        with patch.object(server, "client_plan", return_value=plan):
            prior=[{"id":"reserva-turno-media"}]
            aviso=server.plan_errors({}, prior, prior)
            self.assertEqual(len(aviso), 1)
            self.assertIn("adicional", aviso[0])

    def test_no_contar_asistencia_como_envio_cliente(self):
        now=server.now_ms()
        client={"pedidos":[
            {"fecha":now,"origen":"cliente","estado":"pendiente"},
            {"fecha":now,"origen":"equipo","estado":"aceptado"},
            {"fecha":now,"origen":"cliente","estado":"rechazado"}]}
        self.assertEqual(len(server.changes_this_month(client)),1)
        self.assertEqual(len(server.changes_this_month(client,"equipo")),1)

if __name__ == "__main__":
    unittest.main()
