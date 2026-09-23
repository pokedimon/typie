/**
 * =============================================================================
 * Alpine.js Component: hashModal
 * =============================================================================
 * Manages modal visibility via URL hash routes (e.g., #login, #register),
 * and handles client-side validation and AJAX submissions for registration
 * and login forms.
 */
function hashModal() {
    return {
        // Tracks the active URL hash fragment (e.g. "#login" or "#register")
        currentHash: window.location.hash,

        /**
         * Component Initialization:
         * Listens for browser hash change events (e.g. back/forward button, anchor clicks)
         * to automatically open or close the corresponding modal.
         */
        init() {
            window.addEventListener('hashchange', () => {
                this.currentHash = window.location.hash;
            });
        },

        /**
         * Closes the active modal by stripping the hash from the browser URL
         * using history.pushState (without triggering a full page reload).
         */
        closeModal() {
            history.pushState('', document.title, window.location.pathname + window.location.search);
            this.currentHash = '';
        },

        /**
         * Handles User Registration:
         * 1. Intercepts the form submission.
         * 2. Validates passwords (equality, minimum length 8, allowed characters).
         * 3. Validates school grade if the user selected "in school".
         * 4. Displays validation errors in the modal without reloading.
         * 5. If valid, sends a POST request with JSON credentials to /createuser.
         * 6. Redirects on success or displays server-side validation messages.
         */
        async submitRegister(event) {
            event.preventDefault();

            const form = event.target;
            const data = new FormData(form);

            let grade = 0;
            let message = [];
            const password = data.get('password');

            // --- Client-side Validations ---
            // Ensure repeated password matches
            if (password !== data.get('passwordRpt')) {
                message.push('Пароли не совпадают');
            }

            // Minimum length check
            if (password.length < 8) {
                message.push('Минимальная длина пароля - 8 символов');
            }

            // Character whitelist: alphanumeric plus _, -, @, *
            const passwordPattern = /^[0-9a-zA-Z_\-\@\*]+$/;
            if (!passwordPattern.test(password)) {
                message.push('Пароль может содержать только символы 0-9, a-z, A-Z, _-*@');
            }

            // Check if student selected a valid school grade (1-11)
            if (data.get('inSchool') === 'on') {
                grade = data.get('grade');
                if (grade == 0) {
                    message.push('Выберите класс');
                }
            }

            // Target error message container in the registration modal
            const regMsgContainer = document.getElementById('register-messages');
            regMsgContainer.innerHTML = '';

            // If any validation errors exist, render them and abort submission
            if (message.length > 0) {
                message.forEach(m => {
                    const p = document.createElement('p');
                    p.className = 'text-red-500';
                    p.textContent = m;
                    regMsgContainer.appendChild(p);
                });
                return; 
            }

            // Prepare payload for backend endpoint
            let json = JSON.stringify({
                login: data.get('login'),
                password: password,
                first_name: data.get('firstName'),
                last_name: data.get('lastName'),
                in_school: data.get('inSchool') === 'on',
                grade: grade,
                message: message
            });

            // Send registration payload to the server
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
                            // Render backend rejection messages (e.g. "Логин уже занят")
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

        /**
         * Handles User Login:
         * 1. Intercepts the form submission.
         * 2. Serializes username and password to JSON.
         * 3. Sends POST request to /login.
         * 4. Redirects to main page on successful authentication,
         *    or displays error messages in the login modal.
         */
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
                            // Render authentication error (e.g. "Неверный логин или пароль")
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
    };
}