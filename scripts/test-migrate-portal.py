import importlib.util
import hashlib
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("migration", Path(__file__).with_name("migrate-portal-hash-only.py"))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)

class MigrationTests(unittest.TestCase):
    def test_preserve_hash_and_session_version(self):
        salt = bytes(16)
        digest = hashlib.scrypt(b"fictitious", salt=salt, n=2**14, r=8, p=1).hex()
        portal = {"usuario": "qa", "hash": "scrypt$"+salt.hex()+"$"+digest, "version": 7, "clave": "fake-encrypted"}
        raw = "window.LANZATE_CLIENTES = "+json.dumps([{"id":1,"portal":portal}])+";"
        result, count = migration.migrate(raw)
        self.assertEqual(count, 1)
        expected = dict(portal)
        del expected["clave"]
        self.assertEqual(json.loads(result.split("=",1)[1].rstrip(";"))[0]["portal"], expected)
        self.assertEqual(migration.migrate(result)[1], 0)
    def test_invalid_hash_aborts(self):
        with self.assertRaises(ValueError):
            migration.migrate('window.LANZATE_CLIENTES = [{"portal":{"clave":"fake","hash":"invalid"}}];')

if __name__ == "__main__":
    unittest.main()
