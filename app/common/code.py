class CommonCode:

    common_yn = [{'value': 'Y', 'text': 'y'},
                 {'value': 'N', 'text': 'n'}]

    common_separator = [{'value': 'LF', 'text': 'Linux'},
                        {'value': 'CRLF', 'text': 'Windows'}]

    common_encoding = [{'value': 'ascii', 'text': 'ascii'},
                       {'value': 'utf-8', 'text': 'utf-8'},
                       {'value': 'cp949', 'text': 'cp949'}]

    common_entity_type = [{'value': 'U', 'text': 'User'},
                          {'value': 'G', 'text': 'UserGroup'},
                          {'value': 'T', 'text': 'Task'}]

    common_time_mode = [{'value': 'Y', 'text': 'Yearly'},
                        {'value': 'M', 'text': 'Monthly'},
                        {'value': 'W', 'text': 'Weekly'},
                        {'value': 'D', 'text': 'Daily'},
                        {'value': 'H', 'text': 'Hourly'},
                        {'value': 'O', 'text': 'Once'}]

    common_time_unit = [{'value': 'h', 'text': '시간'},
                        {'value': 'm', 'text': '분'},
                        {'value': 's', 'text': '초'}]

    common_result = [{'value': 'success', 'text': '성공'},
                     {'value': 'fail', 'text': '실패'}]

    common_result2 = [{'value': 'all', 'text': 'ALL'},
                      {'value': 'success', 'text': '성공'},
                      {'value': 'failure', 'text': '실패'}]

    notilist_event = [{'value': 'ES', 'text': '실행 알림'},
                      {'value': 'ET', 'text': '종료 알림'}]

    notilist_method = [{'value': 'mail', 'text': '메일'}]

    user_privilege = [{'value': 'all', 'text': 'ALL'},
                      {'value': '5', 'text': 'Normal-User'},
                      {'value': '9', 'text': 'Super-User'}]

    user_status = [{'value': 'all', 'text': 'ALL'},
                   {'value': 'E', 'text': 'Enable'},
                   {'value': 'D', 'text': 'Disable'}]

    node_past_session = [{'value': 'U', 'text': '-'},
                         {'value': 'R', 'text': 'Resolved'},
                         {'value': 'P', 'text': 'Conflict'}]

    file_type = [{'value': 'F', 'text': 'File'},
                 {'value': 'D', 'text': 'Directory'}]

    acckey_status = [{'value': 'all', 'text': 'ALL'},
                     {'value': 'E', 'text': 'Enable'},
                     {'value': 'D', 'text': 'Disable'}]

    dctnry_type = [{'value': 'all', 'text': 'ALL'},
                   {'value': 'R', 'text': 'Risk'},
                   {'value': 'F', 'text': 'Forbidden'}]

    execution_status = [{'value': 'R', 'text': '실행'},
                        {'value': 'E', 'text': '완료'}]

    execution_result = [{'value': 'all', 'text': 'ALL'},
                        {'value': 'N', 'text': 'N/A'},
                        {'value': 'S', 'text': '성공'},
                        {'value': 'F', 'text': '실패'}]

    execution_node_status = [{'value': 'all', 'text': 'ALL'},
                             {'value': 'W', 'text': '대기'},
                             {'value': 'Q', 'text': '실행요청'},
                             {'value': 'A', 'text': '실행접수'},
                             {'value': 'C', 'text': '실행종료'},
                             {'value': 'T', 'text': '실행중단'}]

    execution_runner_type = [{'value': 'S', 'text': '스케줄'},
                             {'value': 'U', 'text': '사용자'},
                             {'value': 'T', 'text': '태스크'}]

    execution_force_stop = [{'value': 'N', 'text': 'N/A'},
                            {'value': 'Q', 'text': '요청'},
                            {'value': 'A', 'text': '접수'}]
