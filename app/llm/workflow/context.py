"""
Flask 컨텍스트 관리 모듈
"""

# Flask 컨텍스트 정보를 저장하는 전역 변수
_flask_context_info = {
    'config': {},
    'session': {}
}


def set_flask_context_info(config: dict = None, session_info: dict = None):
    """
    현재 Flask 컨텍스트 정보를 전역 변수에 저장합니다.
    task.py에서 build_graph() 호출 전에 이 함수를 호출해야 합니다.

    Args:
        config: Flask app.config 딕셔너리
        session_info: Flask session 딕셔너리
    """
    global _flask_context_info
    if config:
        _flask_context_info['config'] = config.copy() if hasattr(config, 'copy') else dict(config)
    if session_info:
        _flask_context_info['session'] = session_info.copy() if hasattr(session_info, 'copy') else dict(session_info)

    print(f"[set_flask_context_info] Flask 컨텍스트 저장 완료")
    print(f"  - OPMM_REST_API_URL: {_flask_context_info['config'].get('OPMM_REST_API_URL', 'N/A')}")
    print(f"  - user_id: {_flask_context_info['session'].get('login_info', {}).get('user_id', 'N/A')}")


def get_flask_context_info():
    """
    저장된 Flask 컨텍스트 정보를 반환합니다.

    Returns:
        dict: {'config': {...}, 'session': {...}}
    """
    global _flask_context_info
    return _flask_context_info
