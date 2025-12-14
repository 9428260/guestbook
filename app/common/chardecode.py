import base64
import chardet

from charset_normalizer import from_bytes
from flask import current_app
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE


def convert(textinput: str = ''):
    returntext: str = ''
    text = base64.b64decode(textinput.encode())

    encode_dict = {'utf-8': 'utf-8', 'ISO-8859-1': 'utf-8', 'Windows-1252': 'utf-8', 'Windows-1254': 'utf-8'}

    # 1차 utf-8 case
    text_encode_type = 'utf-8'

    # Detect Encoding - cell
    # 1차 detect
    text_encode_dict = chardet.detect(text)
    normalencode = from_bytes(text).best()

    if text_encode_dict['encoding'] is not None:
        if text_encode_dict['encoding'].startswith('ISO'):
            if normalencode is not None:
                text_encode_type = normalencode.encoding

    if text_encode_dict['encoding'] is None:
        error_msg = "[ERROR] Failed encoding detect."
        returntext = error_msg
        current_app.logger.error(error_msg)

    # 1차 cp949 case
    if encode_dict.get(text_encode_dict['encoding']) != 'utf-8':
        if text_encode_dict['encoding'] == 'ascii':
            text_encode_type = 'ascii'
        else:
            text_encode_type = 'cp949'


    # Change Encoding - cell
    if text_encode_type == 'utf-8' or text_encode_type == 'ascii':
        try:
            # ("utf-8")
            returntext = text.decode(text_encode_type)
        except Exception:
            text_encode_type = 'cp949'
            try:
                # ("utf-8 - cp949")
                returntext = text.decode(text_encode_type)
            except Exception:
                # ("utf-8 - cp949 - detected")
                try:
                    returntext = text.decode(text.decode(encoding=text_encode_dict.get('encoding')))
                except Exception:
                    returntext = '?????'

    if text_encode_type == 'cp949':
        try:
            # ("cp949")
            returntext = text.decode(text_encode_type).replace(chr(26), "")
        except Exception:
            text_encode_type = 'utf-8'
            try:
                # ("cp949 - utf-8")
                returntext = text.decode(text_encode_type).replace(chr(26), "")
            except Exception:
                try:
                    # current_app.logger.error(text.decode(text_encode_dict.get('encoding')))
                    returntext = text.decode(encoding=text_encode_dict.get('encoding'), errors='replace')
                except Exception:
                    returntext = '?????'

    return returntext, text_encode_type





