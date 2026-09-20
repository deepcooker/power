from fastapi import Depends, Header, HTTPException
from mysqldbpoolnew import get_connection, get_error_details, format_jsonobj_values_by_type
import logging



# 内部使用的认证函数，直接返回结果或抛出 HTTPException
def authenticate_token(token: str):
    if not token:
        raise HTTPException(status_code=401, detail="缺少token")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        query = "SELECT sp_user_id user_id, status FROM cd_sp_user WHERE token = %s"
        cursor.execute(query, (token,))
        user = cursor.fetchone()

        if user is None:
            # 明确是token不存在，直接抛出401
            raise HTTPException(status_code=401, detail="无效的 token")

        user_id, status = user
        if status == -1:
            raise HTTPException(status_code=429, detail="用户已被锁定，请联系管理员")

        return user_id

    except HTTPException as e:
        # 只捕获我们自己抛出的HTTPException并重新抛出
        raise e
    except Exception as e:
        # 处理数据库操作等真正的服务器错误
        e = get_error_details()
        logging.error(f"检查 token 有效性时出现服务器错误: {e}")
        raise HTTPException(status_code=500, detail=f"服务器错误: {e}")
    finally:
        cursor.close()
        conn.close()

# 对外提供的认证依赖，直接返回 user_id
def require_auth(token: str = Header(None)):
    return authenticate_token(token)


if __name__ == "__main__":
    # 测试有效 token 的情况
    valid_token = "3ad908117ff941af8d72e5e15ea1bcdb"  # 这里需要替换为有效的 token
