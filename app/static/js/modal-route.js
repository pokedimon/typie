function hashModal() {
    return {
        currentHash: window.location.hash,
        init() {
            window.addEventListener('hashchange', () => {
                this.currentHash = window.location.hash;
            });
        },
        closeModal() {
            history.pushState('', document.title, window.location.pathname + window.location.search);
            this.currentHash = '';
        },
        async submitRegister(event) {
            event.preventDefault();

            const form = event.target;
            const data = new FormData(form);

            let grade = 0;
            let message = [];
            const password = data.get('password');

            if (password !== data.get('passwordRpt')) {
                message.push('Пароли не совпадают');
            }

            if (password.length < 8) {
                message.push('Минимальная длина пароля - 8 символов');
            }

            const passwordPattern = /^[0-9a-zA-Z_\-\@\*]+$/;
            if (!passwordPattern.test(password)) {
                message.push('Пароль может содержать только символы 0-9, a-z, A-Z, _-*@');
            }

            if (data.get('inSchool') === 'on') {
                grade = data.get('grade');
                if (grade == 0) {
                    message.push('Выберите класс');
                }
            };

            
            const regMsgContainer = document.getElementById('register-messages');
            
            regMsgContainer.innerHTML = '';

            
            if (message.length > 0) {
                message.forEach(m => {
                    const p = document.createElement('p');
                    p.className = 'text-red-500';
                    p.textContent = m;
                    regMsgContainer.appendChild(p);
                });
                return; 
            }

            console.log(data.get('inSchool'));

            let json = JSON.stringify({
                login: data.get('login'),
                password: password,
                first_name: data.get('firstName'),
                last_name: data.get('lastName'),
                in_school: data.get('inSchool') === 'on',
                grade: grade,
                message: message
            });

            
            
            fetch('/createuser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: json,
                credentials: 'same-origin' 
            })
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    return response.json().then(data => {
                        if (data.redirect) {
                            window.location.href = data.redirect;
                        } else if (data.messages) {
                            
                            regMsgContainer.innerHTML = '';
                            data.messages.forEach(m => {
                                const p = document.createElement('p');
                                p.className = 'text-red-500';
                                p.textContent = m;
                                regMsgContainer.appendChild(p);
                            });
                        }
                    }).catch(() => {});
                }
            })
            .catch(err => {
                console.error('Error submitting registration:', err);
            });
        },
        async submitLogin(event) {
            event.preventDefault();

            const form = event.target;
            const data = new FormData(form);

            let json = JSON.stringify({
                login: data.get('login'),
                password: data.get('password')
            });

            
            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: json,
                credentials: 'same-origin'
            })
            .then(response => {
                
                const loginMsgContainer = document.getElementById('login-messages');
                loginMsgContainer.innerHTML = '';
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    return response.json().then(data => {
                        if (data.redirect) {
                            window.location.href = data.redirect;
                        } else if (data.messages) {
                            data.messages.forEach(m => {
                                const p = document.createElement('p');
                                p.className = 'text-red-500';
                                p.textContent = m;
                                loginMsgContainer.appendChild(p);
                            });
                        }
                    }).catch(() => {});
                }
            })
            .catch(err => {
                console.error('Error submitting login:', err);
            });
        }
    }
}