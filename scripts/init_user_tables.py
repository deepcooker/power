from pathlib import Path
import os
import sys
from datetime import datetime
import bcrypt
import uuid



ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from mysqldbpoolnew import get_connection

SQL_FILE = ROOT / "sql" / "user_tables.sql"


def hash_password(pwd: str):
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt())


def split_sql(sql_text: str):
    current = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            yield "\n".join(current).rstrip(";")
            current = []
    if current:
        yield "\n".join(current)


def main():
    initial_password = os.getenv("INITIAL_ADMIN_PASSWORD")
    if not initial_password:
        raise RuntimeError("INITIAL_ADMIN_PASSWORD is required")
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            for statement in split_sql(SQL_FILE.read_text(encoding="utf-8")):
                cursor.execute(statement)
            hashed_pwd = hash_password(initial_password)
            token = uuid.uuid4().hex
            now = datetime.now()
            cursor.execute("SELECT sp_user_id FROM cd_sp_user WHERE user_name=%s", ("root",))
            exists = cursor.fetchone()
            if exists:
                cursor.execute(
                    """
                    UPDATE cd_sp_user
                    SET pwd=%s, email=%s, token=%s, err_login=0, status=1, source_pwd=%s,
                        nick_name=%s, mobile=%s, update_time=%s
                    WHERE user_name=%s
                    """,
                    (hashed_pwd, "root@yaochuang.tech", token, initial_password, "root", "root", now, "root"),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO cd_sp_user
                    (sp_id, user_name, pwd, create_time, email, token, err_login, status, source_pwd,
                     last_login_time, update_time, nick_name, mobile)
                    VALUES (0,%s,%s,%s,%s,%s,0,1,%s,%s,%s,%s,%s)
                    """,
                    ("root", hashed_pwd, now, "root@yaochuang.tech", token, initial_password, now, now, "root", "root"),
                )
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
