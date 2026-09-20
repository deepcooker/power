import asyncio
import logging
from mysqldbpoolnew import get_connection, get_error_details,format_jsonobj_values_by_type
from datetime import datetime, timedelta
import bcrypt
import uuid  # 导入 uuid 模块
from email_sender import send_email_verification_code
from pydantic import BaseModel
from typing import Optional

from fastapi import APIRouter, Depends, Request


# 配置日志记录
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

MAX_ATTEMPTS = 5  # 最大登录尝试次数
REGISTER_IP_WINDOW_MINUTES = 60
REGISTER_IP_MAX_ATTEMPTS = 10
REGISTER_IP_ATTEMPTS = {}

# 创建用户相关接口的路由
user_router = APIRouter()

# 定义注册接口的请求体模型
class RegisterRequest(BaseModel):
    user_name: str  # 用户名
    pwd: str  # 密码
    email: Optional[str] = ""  # 邮箱
    verification_code: Optional[str] = ""  # 验证码
    sp_id: int = 0  # 服务提供商ID（可选，默认为0）

# 定义登录接口的请求体模型
class LoginRequest(BaseModel):
    user_name: str  # 用户名
    pwd: str  # 密码

# 定义登出接口的请求体模型
class LoginOutRequest(BaseModel):
    token: str  #token


# 定义修改密码接口的请求体模型
class ChangePasswordRequest(BaseModel):
    email: str  # 邮箱
    verification_code: str  # 验证码
    new_pwd: str  # 新密码

# 定义发送验证码接口的请求体模型
class SendVerificationCodeRequest(BaseModel):
    email: str  # 邮箱

# 用户注册接口
@user_router.post("/register/")
async def api_register(request: Request, payload: RegisterRequest):
    """
    用户注册接口
    - 功能：创建新用户账户
    - 请求参数：用户名、密码、邮箱、验证码、服务提供商ID
    - 返回：注册结果（成功返回token，失败返回错误信息）
    """
    client_ip = get_client_ip(request)
    allowed, err_desc = check_register_ip_limit(client_ip)
    if not allowed:
        return {"err_code": 429, "err_desc": err_desc, "data": {}}
    return register_user(payload.user_name, payload.pwd, payload.email or "", payload.verification_code or "", payload.sp_id or 0)

# 用户登录接口
@user_router.post("/login/")
async def api_login(request: LoginRequest):
    """
    用户登录接口
    - 功能：验证用户身份并生成登录凭证
    - 请求参数：用户名、密码
    - 返回：登录结果（成功返回token，失败返回错误信息）
    """
    return login_user(request.user_name, request.pwd)




# 用户登出接口
@user_router.post("/logout/")
async def api_logout(request: LoginOutRequest):
    """
    用户登出接口
    - 功能：使当前用户的token失效
    - 请求参数：通过Authorization header传递token
    - 返回：登出结果
    """

    return logout_user(request.token)

# 修改密码接口
@user_router.post("/changepwd/")
async def api_changepwd(request: ChangePasswordRequest):
    """
    修改密码接口
    - 功能：通过邮箱验证码重置用户密码
    - 请求参数：邮箱、验证码、新密码
    - 返回：操作结果（成功或失败信息）
    """
    return change_password(request.email, request.verification_code, request.new_pwd)

@user_router.get("/getuserinfo/")
def api_get_user_info_by_token(token:str):
    return get_user_info_by_token(token)

# 发送验证码接口
@user_router.post("/send_verification_code/")
async def api_send_verification_code(request: SendVerificationCodeRequest):
    """
    发送验证码接口
    - 功能：向指定邮箱发送验证码
    - 请求参数：邮箱
    - 返回：发送结果（成功或失败信息）
    """
    return send_email_verification_code(request.email)

def hash_password(pwd):
    """
    对密码进行哈希处理
    - 参数：明文密码
    - 返回：哈希后的密码
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd.encode('utf-8'), salt)
    return hashed

def verify_password(pwd, hashed_pwd):
    """
    验证密码是否匹配
    - 参数：明文密码、哈希后的密码
    - 返回：布尔值，表示密码是否匹配
    """
    if isinstance(hashed_pwd, str):
        hashed_pwd = hashed_pwd.encode('utf-8')
    return bcrypt.checkpw(pwd.encode('utf-8'), hashed_pwd)

def get_client_ip(request: Request):
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    real_ip = request.headers.get("x-real-ip", "")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"

def check_register_ip_limit(client_ip: str):
    now = datetime.now()
    window_start = now - timedelta(minutes=REGISTER_IP_WINDOW_MINUTES)
    attempts = [item for item in REGISTER_IP_ATTEMPTS.get(client_ip, []) if item > window_start]
    if len(attempts) >= REGISTER_IP_MAX_ATTEMPTS:
        REGISTER_IP_ATTEMPTS[client_ip] = attempts
        return False, "注册过于频繁，请稍后再试"
    attempts.append(now)
    REGISTER_IP_ATTEMPTS[client_ip] = attempts
    return True, ""

def register_user(user_name, pwd, email, verification_code, sp_id=0):
    """
    用户注册逻辑
    1. 验证用户名和邮箱唯一性
    2. 校验验证码有效性
    3. 对密码进行哈希处理
    4. 生成唯一token
    5. 创建新用户记录
    """
    user_name = user_name.strip() if isinstance(user_name, str) else ""
    pwd = pwd.strip() if isinstance(pwd, str) else ""
    email = email.strip() if isinstance(email, str) else ""
    verification_code = verification_code.strip() if isinstance(verification_code, str) else ""
    sp_id = 0 if sp_id is None else int(sp_id)
    if not user_name:
        return {"err_code": 400, "err_desc": "请输入用户名", "data": {}}
    if not pwd:
        return {"err_code": 400, "err_desc": "请输入密码", "data": {}}
    if len(user_name) < 3:
        return {"err_code": 400, "err_desc": "用户名至少3位", "data": {}}
    if len(pwd) < 6:
        return {"err_code": 400, "err_desc": "密码至少6位", "data": {}}
    if not email:
        email = f"{user_name}@local.lingqu"

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 校验用户名和邮箱是否唯一
        check_query = "SELECT * FROM cd_sp_user WHERE user_name = %s OR email = %s"
        cursor.execute(check_query, (user_name, email))
        existing_user = cursor.fetchone()
        if existing_user:
            return {"err_code": 400, "err_desc": "用户名或邮箱已存在", "data": {}}

        if verification_code:
            # 从 cd_verification_code 表中查询验证码并验证
            check_verify_query = "SELECT verification_code, update_time FROM cd_verification_code WHERE verify_id = %s"
            cursor.execute(check_verify_query, (email,))
            result = cursor.fetchone()
            if not result:
                return {"err_code": 400, "err_desc": "验证码不存在", "data": {}}
            stored_verify, stored_time = result
            if verification_code != stored_verify:
                return {"err_code": 400, "err_desc": "验证码错误", "data": {}}
            if datetime.now() - stored_time > timedelta(minutes=5):
                return {"err_code": 400, "err_desc": "验证码已过期", "data": {}}

        # 对密码进行哈希处理
        hashed_pwd = hash_password(pwd)

        # 生成 uuid 格式的 token
        token = str(uuid.uuid4()).replace('-', '')

        # 插入新用户，err_login 初始值设为 0，status 设为 1（正常状态），last_login_time 设为 None，verify 设为验证码
        create_time = datetime.now()
        insert_query = "INSERT INTO cd_sp_user (sp_id, user_name, pwd, create_time, email, token, err_login, status, source_pwd, last_login_time, update_time) VALUES (%s, %s, %s, %s, %s, %s, 0, 1, %s, %s, %s)"
        cursor.execute(insert_query, (sp_id, user_name, hashed_pwd, create_time, email, token, pwd, create_time, create_time))

        conn.commit()
        return {"err_code": 0, "err_desc": "", "data": {"token": token}}
    except Exception as e:
        e = get_error_details()
        logging.error(f"注册用户时出现服务器错误: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}
    finally:
        cursor.close()
        conn.close()

def login_user(user_name, pwd):
    """
    用户登录逻辑
    1. 根据用户名查找用户
    2. 验证用户状态
    3. 校验密码
    4. 更新登录尝试次数和最后登录时间
    """
    user_name = user_name.strip() if isinstance(user_name, str) else user_name
    pwd = pwd.strip() if isinstance(pwd, str) else pwd
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 根据用户名查询用户
        query = "SELECT pwd, token, err_login, status, last_login_time, update_time FROM cd_sp_user WHERE user_name = %s"
        cursor.execute(query, (user_name,))
        user = cursor.fetchone()
        if user:
            hashed_pwd, token, err_login, status, last_login_time, _ = user
            if status == -1:
                return {"err_code": 429, "err_desc": "用户已被锁定，请联系管理员", "data": {}}

            if verify_password(pwd, hashed_pwd):
                # 登录成功，将 err_login 清 0，更新 last_login_time 和 update_time
                update_query = "UPDATE cd_sp_user SET err_login = 0, last_login_time = %s, update_time = %s WHERE user_name = %s"
                current_time = datetime.now()
                cursor.execute(update_query, (current_time, current_time, user_name))
                conn.commit()
                return {"err_code": 0, "err_desc": "", "data": {"token": token}}
            else:
                # 密码错误，增加 err_login 次数
                new_err_login = (err_login or 0) + 1
                update_query = "UPDATE cd_sp_user SET err_login = %s WHERE user_name = %s"
                cursor.execute(update_query, (new_err_login, user_name))
                if new_err_login >= MAX_ATTEMPTS:
                    # 错误次数达到 5 次，将用户状态设为 -1（锁定）
                    lock_query = "UPDATE cd_sp_user SET status = -1 WHERE user_name = %s"
                    cursor.execute(lock_query, (user_name,))
                conn.commit()
                return {"err_code": 401, "err_desc": "用户名或密码错误", "data": {}}
        else:
            return {"err_code": 401, "err_desc": "用户名或密码错误", "data": {}}
    except Exception as e:
        e = get_error_details()
        logging.error(f"用户登录时出现服务器错误: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}
    finally:
        cursor.close()
        conn.close()


def logout_user(token):
    """
    用户登出逻辑
    1. 根据token查找用户
    2. 生成新token使旧token失效
    3. 更新用户token和登出时间
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 根据token查询用户
        query = "SELECT user_name FROM cd_sp_user WHERE token = %s AND status = 1"
        cursor.execute(query, (token,))
        user = cursor.fetchone()

        if not user:
            return {"err_code": 401, "err_desc": "无效的token", "data": {}}

        user_name = user[0]

        # 生成新token
        new_token = str(uuid.uuid4()).replace('-', '')

        # 更新用户token和登出时间
        update_query = "UPDATE cd_sp_user SET token = %s, update_time = %s WHERE token = %s"
        current_time = datetime.now()
        cursor.execute(update_query, (new_token, current_time, token))
        conn.commit()

        return {"err_code": 0, "err_desc": "登出成功", "data": {}}
    except Exception as e:
        e = get_error_details()
        logging.error(f"用户登出时出现服务器错误: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}
    finally:
        cursor.close()
        conn.close()


def change_password(email, verification_code, new_pwd):
    """
    修改密码逻辑
    1. 验证验证码有效性
    2. 对新密码进行哈希处理
    3. 更新用户密码和相关时间戳
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 从 cd_verification_code 表中查询验证码并验证
        check_verify_query = "SELECT verification_code, update_time FROM cd_verification_code WHERE verify_id = %s"
        cursor.execute(check_verify_query, (email,))
        result = cursor.fetchone()
        if not result:
            return {"err_code": 400, "err_desc": "验证码不存在", "data": {}}
        stored_verify, stored_time = result
        if verification_code != stored_verify:
            return {"err_code": 400, "err_desc": "验证码错误", "data": {}}
        if datetime.now() - stored_time > timedelta(minutes=5):
            return {"err_code": 400, "err_desc": "验证码已过期", "data": {}}

        # 对新密码进行哈希处理
        hashed_new_pwd = hash_password(new_pwd)

        # 更新 cd_sp_user 表中的 source_pwd 和 pwd 字段，以及 update_time 字段
        update_query = "UPDATE cd_sp_user SET source_pwd = %s, pwd = %s, update_time = %s WHERE email = %s"
        current_time = datetime.now()
        cursor.execute(update_query, (new_pwd, hashed_new_pwd, current_time, email))
        conn.commit()

        return {"err_code": 0, "err_desc": "", "data": {}}
    except Exception as e:
        e = get_error_details()
        logging.error(f"修改密码时出现服务器错误: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}
    finally:
        cursor.close()
        conn.close()

def check_token_validity(token):
    """
    验证 Token 有效性（用于身份认证）
    - 参数：token (str)
    - 返回：验证成功返回空数据，失败返回错误信息
    """
    # 检查 Token 是否为空
    if not token:
        return {"err_code": 401, "err_desc": "缺少身份验证令牌", "data": {}}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        query = "SELECT status FROM cd_sp_user WHERE token = %s"
        cursor.execute(query, (token,))
        user = cursor.fetchone()

        if not user:
            return {"err_code": 401, "err_desc": "无效的身份验证令牌", "data": {}}

        status = user[0]  # 直接获取状态字段
        if status == -1:
            return {"err_code": 429, "err_desc": "用户已被锁定，请联系管理员", "data": {}}

        # 验证成功时不返回用户ID，仅返回成功状态
        return {"err_code": 0, "err_desc": "", "data": {}}

    except Exception as e:
        e = get_error_details()
        logging.error(f"Token 验证失败: {e}")
        return {"err_code": 500, "err_desc": "服务器内部错误", "data": {}}
    finally:
        cursor.close()
        conn.close()

def get_user_info_by_token(token):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        query = "SELECT user_name, email,head_url, last_login_time FROM cd_sp_user WHERE token = %s"
        cursor.execute(query, (token,))
        user = cursor.fetchone()

        if user:
            # 将元组转换为字典
            user_dict = {
                'user_name': user[0],
                'email': user[1],
                'head_url': user[2],
                'last_login_time': user[3]
            }

            # 使用你的成熟方法处理字典
            formatted_user = format_jsonobj_values_by_type(user_dict)

            return {"err_code": 0, "err_desc": "", "data": formatted_user}
        else:
            return {"err_code": 401, "err_desc": "无效的 token", "data": {}}
    except Exception as e:
        e = get_error_details()
        logging.error(f"根据 token 获取用户信息时出现服务器错误: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":

    print(1)
    print('发送验证码')
    send_email_verification_code('42396509@qq.com')
    print('注册用户')
    a = register_user('test_user','source_pwd', '42396509@qq.com', '123456')
    print(a)
    print('登录用户')
    b = login_user('test_user','source_pwd')
    print(b)
    print('修改密码')
    c = change_password('42396509@qq.com', '123456', '111')
    print(c)
    print('再登录')
    d = login_user('test_user','111')
    print(d)
    if d["err_code"] == 0:
        token = d["data"]["token"]
        print("获取到的token:", token)
        print('验证token有效性')
        token_check_result = check_token_validity(token)
        print("token有效性验证结果:", token_check_result)
        print('根据token查询用户信息')
        user_info_result = get_user_info_by_token(token)
        print("根据token查询用户信息结果:", user_info_result)
    else:
        print("登录失败，无法进行token相关测试", d)
