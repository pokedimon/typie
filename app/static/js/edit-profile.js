/**
 * =============================================================================
 * Alpine.js Component: editProfile
 * =============================================================================
 * Handles user profile editing:
 * - Controls the profile edit modal state (open/close).
 * - Manages first name and last name input fields.
 * - Handles client-side avatar image selection, square aspect ratio (1:1) validation,
 *   canvas-based resizing/downscaling to 512x512, and base64 encoding.
 * - Submits updated profile information to the `/edit_profile` backend endpoint.
 */
function editProfile(initialFirstName = '', initialLastName = '') {
    return {
        isOpen: false,
        firstName: initialFirstName,
        lastName: initialLastName,
        initialFirstName: initialFirstName,
        initialLastName: initialLastName,
        avatarB64: null,
        previewUrl: null,
        errorMessage: '',

        /**
         * Opens the profile editing modal and resets the form inputs
         * to the user's initial details.
         */
        openModal() {
            this.isOpen = true;
            this.firstName = this.initialFirstName;
            this.lastName = this.initialLastName;
            this.errorMessage = '';
            this.previewUrl = null;
            this.avatarB64 = null;
            if (this.$refs.fileInput) {
                this.$refs.fileInput.value = '';
            }
        },

        /**
         * Closes the edit profile modal.
         */
        closeModal() {
            this.isOpen = false;
        },

        /**
         * Handles avatar image file selection:
         * 1. Reads the selected file using FileReader.
         * 2. Loads the image into an Image object to verify 1:1 aspect ratio (square).
         * 3. Draws the image onto a 512x512 canvas to normalize and downscale avatar resolution.
         * 4. Converts the canvas to a base64 PNG data URL (`canvas.toDataURL('image/png')`)
         *    for live preview and backend payload transmission.
         */
        handleFileChange(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Enforce square aspect ratio
                    if (img.width !== img.height) {
                        this.errorMessage = 'Изображение должно быть квадратным (соотношение сторон 1:1)';
                        if (this.$refs.fileInput) {
                            this.$refs.fileInput.value = '';
                        }
                        return;
                    }
                    this.errorMessage = '';

                    // Resize image to standard 512x512 dimensions via HTML5 Canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 512, 512);

                    // Store base64 data URL for preview and submission
                    this.avatarB64 = canvas.toDataURL('image/png');
                    this.previewUrl = this.avatarB64;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        },

        /**
         * Submits updated profile data:
         * Builds payload with first_name, last_name, and optional avatar_b64,
         * dispatches POST request to `/edit_profile`, and reloads the page on success.
         */
        async submitEdit() {
            const payload = {
                first_name: this.firstName,
                last_name: this.lastName,
            };
            if (this.avatarB64) {
                payload.avatar_b64 = this.avatarB64;
            }

            try {
                const response = await fetch('/edit_profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    window.location.reload();
                } else {
                    this.errorMessage = 'Произошла ошибка при сохранении';
                }
            } catch (error) {
                this.errorMessage = 'Произошла ошибка';
            }
        }
    };
}

// Register as an Alpine component once Alpine initializes
document.addEventListener('alpine:init', () => {
    Alpine.data('editProfile', (firstName = '', lastName = '') => editProfile(firstName, lastName));
});
