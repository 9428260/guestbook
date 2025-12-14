from flask import render_template, session


class Render:
    @staticmethod
    def render_template(template_path, **kwargs):

        render_dict = {**kwargs}
        if 'login_info' not in session:
            return render_template(template_path, **kwargs)

        if 'user_id' in session['login_info']:
            render_dict['login_id'] = session['login_info']['user_id']

        if 'privilege' in session['login_info']:
            render_dict['login_privilege'] = session['login_info']['privilege']

        # return render_template(template_path, **kwargs)
        return render_template(template_path, **render_dict)

