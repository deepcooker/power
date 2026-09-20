import smtplib
from email.mime import multipart, text
from email.utils import make_msgid
from pathlib import Path
import sys
import logging
import os
from datetime import datetime

# 导入 mysqldbpoolnew 模块
from mysqldbpoolnew import get_connection, get_error_details

# 配置日志记录
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 假设这些配置在你的 settings 中定义，这里先使用一些示例值，你需要根据实际情况修改
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.exmail.qq.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PWD = os.getenv('SMTP_PASSWORD', '')


def send_email_verification_code(to_addr):
    code = '123456'
    print(code)
    msg = multipart.MIMEMultipart('alternative')
    msg['From'] = "no-reply@art-lj.com"
    msg['To'] = to_addr

    # 检查邮箱是否已存在于 cd_sp_user 表中
    conn = get_connection()
    cursor = conn.cursor()
    try:
        check_query = "SELECT * FROM cd_sp_user WHERE email = %s"
        cursor.execute(check_query, (to_addr,))
        existing_user = cursor.fetchone()
        if existing_user:
            msg['Subject'] = 'Password Reset'  # 邮箱已存在，设置主题为‘修改密码’
        else:
            msg['Subject'] = 'Account Registration'  # 邮箱不存在，设置主题为‘帐号注册’
    except Exception as e:
        e = get_error_details()
        logging.error(f"检查邮箱存在性时出现错误: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}
    finally:
        cursor.close()
        conn.close()

    msg['Message-ID'] = make_msgid()

    # 获取当前工作目录
    current_dir = Path.cwd()
    html_file = current_dir / 'email_tool' / 'email.html'

    try:
        with open(html_file, 'r') as f:
            html_text = f.read()
        html_text = html_text.replace('${code}', code)
        mime_text = text.MIMEText(html_text, 'html')
        msg.attach(mime_text)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PWD)
            smtp.sendmail(SMTP_USER, to_addr, msg.as_string())

        # 将验证码和更新时间插入到 cd_verification_code 表中
        conn = get_connection()
        cursor = conn.cursor()
        try:
            update_time = datetime.now()
            insert_query = "INSERT INTO cd_verification_code (verify_id, verification_code, update_time) " \
                           "VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE verification_code = %s, update_time = %s"
            cursor.execute(insert_query, (to_addr, code, update_time, code, update_time))
            conn.commit()
        except Exception as e:
            e = get_error_details()
            logging.error(f"插入验证码到 cd_verification_code 表时出现错误: {e}")
        finally:
            cursor.close()
            conn.close()

        logging.info(f"邮件发送成功至 {to_addr}")
        return {"err_code": 0, "err_desc": "", "data": {}}
    except Exception as e:
        e = get_error_details()
        logging.error(f"邮件发送失败: {e}")
        return {"err_code": 500, "err_desc": f"服务器错误: {e}", "data": {}}


if __name__ == "__main__":
    # 测试用的收件人邮箱地址
    test_to_addr = '42396509@qq.com'
    # 测试用的验证码
    # test_code = '123456'
    result = send_email_verification_code(test_to_addr)
    print(result)
