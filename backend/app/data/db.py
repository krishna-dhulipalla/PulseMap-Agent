import sqlite3
from . import store  # ensure tables are created on import (store does CREATE TABLE)

def get_reports_conn() -> sqlite3.Connection:
    # store.py already keeps a module-level connection; this is a placeholder
    from .store import _CONN as REPORTS_CONN  # type: ignore
    return REPORTS_CONN
