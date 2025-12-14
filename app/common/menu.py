class Menu:
    # sub menu
    #sample_sub = [{'id': 'rest', 'value': 'REST', 'url': '/sample/rest'},
    #              {'id': 'color', 'value': 'COLOR', 'url': '/sample/color'},
    #              {'id': 'dash', 'value': 'DASHBOARD', 'url': '/sample/dashboard'}]

    user_sub = [{'id': 'user', 'value': '사용자', 'url': '/user'},
                {'id': 'usergrp', 'value': '사용자그룹', 'url': '/usergroup'},
                {'id': 'role', 'value': '역할', 'url': '/role'}]

    node_sub = [{'id': 'node', 'value': '노드', 'url': '/node'},
                {'id': 'nodereview', 'value': '연결검토', 'url': '/nodereview'}]

    task_sub = [{'id': 'task', 'value': '태스크', 'url': '/task'},
                {'id': 'publist', 'value': '태스크발행이력', 'url': '/publist'},
                {'id': 'execution', 'value': '태스크실행결과', 'url': '/execution'},
                {'id': 'dctnry', 'value': '단어사전', 'url': '/dctnry'}]

    file_sub = [{'id': 'filehub', 'value': '파일허브', 'url': '/filehub'},
                {'id': 'file', 'value': '파일상세', 'url': '/file'}]

    system_sub = [{'id': 'acckey', 'value': '엑세스 키', 'url': '/acckey'},
                  {'id': 'system', 'value': '시스템속성', 'url': '/system'}]

    # menu
    menu_list = [  # {'id': 'sample', 'value': 'SAMPLE', 'sub': sample_sub},
                 {'id': 'user', 'value': '사용자', 'sub': user_sub},
                 {'id': 'node', 'value': '노드', 'sub': node_sub},
                 {'id': 'task', 'value': '태스크', 'sub': task_sub},
                 {'id': 'file', 'value': '파일', 'sub': file_sub},
                 {'id': 'system', 'value': '시스템', 'sub': system_sub}, ]
