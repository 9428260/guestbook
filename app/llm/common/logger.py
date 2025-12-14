import logging
import os
from datetime import datetime

class FileLogger:
    def __init__(self, log_dir: str = "logs", log_file: str = None, level=logging.INFO):
        """
        독립적인 파일 로거 초기화

        Args:
            log_dir (str): 로그 파일 저장 경로 (기본값: logs/)
            log_file (str): 로그 파일 이름 (기본값: 실행 날짜 기반)
            level (int): 로깅 레벨 (기본값: INFO)
        """
        os.makedirs(log_dir, exist_ok=True)

        if log_file is None:
            log_file = datetime.now().strftime("%Y-%m-%d") + ".log"

        log_path = os.path.join(log_dir, log_file)

        self.logger = logging.getLogger(log_file)
        self.logger.setLevel(level)

        # 중복 핸들러 방지
        if not self.logger.handlers:
            file_handler = logging.FileHandler(log_path, encoding="utf-8")
            formatter = logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

    def debug(self, msg: str):
        self.logger.debug(msg)

    def info(self, msg: str):
        self.logger.info(msg)

    def warning(self, msg: str):
        self.logger.warning(msg)

    def error(self, msg: str):
        self.logger.error(msg)

    def critical(self, msg: str):
        self.logger.critical(msg)