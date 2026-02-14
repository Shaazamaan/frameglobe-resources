// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // ✅ Google Apps Script Backend URL - CONNECTED!
    BACKEND_URL: 'https://script.google.com/macros/s/AKfycbyopE5PawXsAdZmN_9MPxxeOAQI0m_X44UUFGeIFsnebPuItTdrTd6Ti0s6SAADNa2b/exec',

    // LocalStorage keys
    STORAGE_KEYS: {
        USER_EMAIL: 'art_user_email',
        USER_NAME: 'art_user_name',
        DOWNLOAD_LINK: 'art_download_link'
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        postId: params.get('post') || 'default',
        igUser: params.get('ig_user') || ''
    };
}

function setLoadingState(formId, buttonId, loadingId, isLoading) {
    const button = document.getElementById(buttonId);
    const loading = document.getElementById(loadingId);

    if (button) button.disabled = isLoading;
    if (loading) {
        if (isLoading) {
            loading.classList.add('active');
        } else {
            loading.classList.remove('active');
        }
    }
}

function saveToLocalStorage(email, name) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_EMAIL, email);
    if (name) localStorage.setItem(CONFIG.STORAGE_KEYS.USER_NAME, name);
}

function getFromLocalStorage(key) {
    return localStorage.getItem(key);
}

// ============================================
// API FUNCTIONS
// ============================================
async function submitLeadForm(formData) {
    const response = await fetch(CONFIG.BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'submit-lead',
            ...formData
        })
    });

    if (!response.ok) {
        throw new Error('Failed to submit form');
    }

    return await response.json();
}

async function submitWaitlistForm(email, courseType, artType, isUpdate = false) {
    const response = await fetch(CONFIG.BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: isUpdate ? 'update-waitlist' : 'submit-waitlist',
            email,
            courseType,
            artType
        })
    });

    if (!response.ok) {
        throw new Error('Failed to submit waitlist');
    }

    return await response.json();
}

async function checkExistingUser(email) {
    const response = await fetch(`${CONFIG.BACKEND_URL}?action=check-user&email=${encodeURIComponent(email)}`);

    if (!response.ok) {
        return null;
    }

    return await response.json();
}

async function getWaitlistCounter() {
    const response = await fetch(`${CONFIG.BACKEND_URL}?action=get-counter`);

    if (!response.ok) {
        return 0;
    }

    const data = await response.json();
    return data.count || 0;
}

function triggerDownload(downloadUrl) {
    // Create temporary anchor element
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Store download link for confirmation page
    localStorage.setItem(CONFIG.STORAGE_KEYS.DOWNLOAD_LINK, downloadUrl);
}

// ============================================
// INDEX.HTML - LEAD CAPTURE PAGE
// ============================================
if (document.getElementById('leadForm')) {
    // Check for returning user on page load
    window.addEventListener('DOMContentLoaded', async () => {
        const storedEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
        const { postId, igUser } = getURLParams();

        if (storedEmail) {
            // Returning user - hide form, show direct download
            document.getElementById('leadFormSection').classList.add('hidden');
            document.getElementById('directDownloadSection').classList.remove('hidden');

            // Get download link for this post
            try {
                const response = await fetch(`${CONFIG.BACKEND_URL}?action=get-download&email=${encodeURIComponent(storedEmail)}&postId=${postId}&igUser=${encodeURIComponent(igUser)}`);
                const data = await response.json();

                if (data.success) {
                    // Set up direct download button
                    document.getElementById('directDownloadBtn').addEventListener('click', () => {
                        triggerDownload(data.downloadLink);
                        // Redirect to confirmation page
                        setTimeout(() => {
                            window.location.href = `confirmation.html?existing=${data.hasInterest ? 'true' : 'false'}`;
                        }, 500);
                    });
                }
            } catch (error) {
                console.error('Error fetching download:', error);
            }
        }
    });

    // Lead form submission
    document.getElementById('leadForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        setLoadingState('leadForm', 'submitBtn', 'loadingState', true);

        const { postId, igUser } = getURLParams();
        const formData = {
            name: document.getElementById('name').value,
            city: document.getElementById('city').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            postId,
            igUser
        };

        try {
            const response = await submitLeadForm(formData);

            if (response.success) {
                // Save to localStorage
                saveToLocalStorage(formData.email, formData.name);

                // Trigger download
                if (response.downloadLink) {
                    triggerDownload(response.downloadLink);
                }

                // Redirect to confirmation page
                setTimeout(() => {
                    window.location.href = 'confirmation.html';
                }, 1000);
            } else {
                alert('Error submitting form. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setLoadingState('leadForm', 'submitBtn', 'loadingState', false);
        }
    });
}

// ============================================
// CONFIRMATION.HTML - WAITING LIST PAGE
// ============================================
if (document.getElementById('waitlistForm') || document.getElementById('updateForm')) {
    window.addEventListener('DOMContentLoaded', async () => {
        const userEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
        const downloadLink = getFromLocalStorage(CONFIG.STORAGE_KEYS.DOWNLOAD_LINK);

        // Set up backup download button
        if (downloadLink && document.getElementById('backupDownloadBtn')) {
            document.getElementById('backupDownloadBtn').addEventListener('click', () => {
                triggerDownload(downloadLink);
            });
        }

        // Update counter
        try {
            const count = await getWaitlistCounter();
            const counterElements = document.querySelectorAll('#counterNumber, #existingCounter');
            counterElements.forEach(el => {
                if (el) el.textContent = count;
            });
        } catch (error) {
            console.error('Error fetching counter:', error);
        }

        // Check if user already has course interest
        if (userEmail) {
            try {
                const userData = await checkExistingUser(userEmail);

                if (userData && userData.hasInterest) {
                    // User already on waiting list - show existing interest section
                    document.getElementById('waitingListSection').classList.add('hidden');
                    document.getElementById('existingInterestSection').classList.remove('hidden');

                    // Display current preferences
                    document.getElementById('currentCourse').textContent = userData.courseType;
                    document.getElementById('currentArtType').textContent = userData.artType;

                    // Pre-fill update form
                    document.getElementById('updateCourseType').value = userData.courseType;
                    document.getElementById('updateArtType').value = userData.artType;
                } else {
                    // New user or no interest yet - show waiting list form
                    document.getElementById('waitingListSection').classList.remove('hidden');
                    document.getElementById('existingInterestSection').classList.add('hidden');
                }
            } catch (error) {
                console.error('Error checking user:', error);
                // Default to showing waitlist form
                document.getElementById('waitingListSection').classList.remove('hidden');
            }
        }
    });

    // Waiting list form submission (new users)
    if (document.getElementById('waitlistForm')) {
        document.getElementById('waitlistForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const userEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
            if (!userEmail) {
                alert('Error: Email not found. Please go back and fill the form.');
                return;
            }

            setLoadingState('waitlistForm', 'waitlistSubmitBtn', 'waitlistLoading', true);

            const courseType = document.getElementById('courseType').value;
            const artType = document.getElementById('artType').value;

            try {
                const response = await submitWaitlistForm(userEmail, courseType, artType, false);

                if (response.success) {
                    // Hide form, show success message
                    document.getElementById('waitlistForm').classList.add('hidden');
                    document.getElementById('waitlistSuccess').classList.remove('hidden');

                    // Update counter
                    if (response.count) {
                        document.getElementById('counterNumber').textContent = response.count;
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to join waiting list. Please try again.');
            } finally {
                setLoadingState('waitlistForm', 'waitlistSubmitBtn', 'waitlistLoading', false);
            }
        });
    }

    // Update preferences button
    if (document.getElementById('updatePreferencesBtn')) {
        document.getElementById('updatePreferencesBtn').addEventListener('click', () => {
            document.getElementById('updateForm').classList.remove('hidden');
        });
    }

    // Update form submission (existing users)
    if (document.getElementById('updateForm')) {
        document.getElementById('updateForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const userEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
            const courseType = document.getElementById('updateCourseType').value;
            const artType = document.getElementById('updateArtType').value;

            try {
                const response = await submitWaitlistForm(userEmail, courseType, artType, true);

                if (response.success) {
                    // Update displayed values
                    document.getElementById('currentCourse').textContent = courseType;
                    document.getElementById('currentArtType').textContent = artType;

                    // Hide form, show success
                    document.getElementById('updateForm').classList.add('hidden');
                    document.getElementById('updateSuccess').classList.remove('hidden');

                    // Hide success message after 3 seconds
                    setTimeout(() => {
                        document.getElementById('updateSuccess').classList.add('hidden');
                    }, 3000);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to update preferences. Please try again.');
            }
        });
    }
}
