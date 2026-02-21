// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // ✅ Google Apps Script Backend URL - FIXED & STABLE!
    BACKEND_URL: 'https://script.google.com/macros/s/AKfycbwG-0B1rNliyZovesBoaPEuUlSzrG1vKfzhQx7PUcXtDRBZVoa_hcwFFgVyC5UYLMz8cg/exec',

    // LocalStorage keys
    STORAGE_KEYS: {
        USER_EMAIL: 'art_user_email',
        USER_NAME: 'art_user_name',
        DOWNLOAD_LINK: 'art_download_link',
        USER_ROLE: 'art_user_role'
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

function saveToLocalStorage(email, name, role = 'User') {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_EMAIL, email);
    if (name) localStorage.setItem(CONFIG.STORAGE_KEYS.USER_NAME, name);
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ROLE, role);
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
            'Content-Type': 'text/plain',
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
            'Content-Type': 'text/plain',
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
            console.error('Submission error:', error);
            const errorMsg = error.message.includes('Unexpected token')
                ? 'Server Error: The backend script crashed. Please ensure you ran "setupSheets" in Google Apps Script.'
                : 'Connection Error: ' + error.message;
            alert(errorMsg);
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
// ============================================
// LOGIN.HTML - LOGIN PAGE
// ============================================
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const errorEl = document.getElementById('loginError');
        const submitBtn = document.getElementById('loginSubmitBtn');
        const loadingState = document.getElementById('loginLoading');

        // Reset state
        errorEl.classList.add('hidden');
        setLoadingState('loginForm', 'loginSubmitBtn', 'loginLoading', true);

        try {
            const userData = await checkExistingUser(email);

            if (userData && userData.exists) {
                // User found - save to local storage
                saveToLocalStorage(email, userData.name || '', userData.role || 'User');

                // Redirect based on role
                if (userData.role === 'Admin' || userData.role === 'Staff') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html';
                }
            } else {
                // User not found
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMsg = error.message.includes('Unexpected token')
                ? 'Server Error: Please ensure you ran "setupSheets" in Google Apps Script and re-deployed.'
                : 'Connection Error: ' + error.message;
            alert(errorMsg);
        } finally {

            setLoadingState('loginForm', 'loginSubmitBtn', 'loginLoading', false);
        }
    });
}
// ============================================
// ADMIN DASHBOARD - TABS & RBAC
// ============================================

window.switchTab = (tabId) => {
    // Hide all sections
    document.querySelectorAll('section.admin-card').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // Show selected
    document.getElementById(`${tabId}Section`).classList.remove('hidden');

    // Find button and set active
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabId));
    if (btn) btn.classList.add('active');

    // Trigger data load
    const adminEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
    if (tabId === 'users') loadUsers(adminEmail);
    if (tabId === 'analytics') loadAnalytics(adminEmail);
};

// ============================================
// ADMIN.HTML - DASHBOARD LOGIC
// ============================================
if (document.getElementById('resourceTableBody')) {
    window.addEventListener('DOMContentLoaded', async () => {
        const adminEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
        const adminRole = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_ROLE);
        const userName = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_NAME);

        if (!adminEmail || (adminRole !== 'Admin' && adminRole !== 'Staff')) {
            window.location.href = 'login.html';
            return;
        }

        // Setup Welcome
        document.getElementById('userWelcome').textContent = `Welcome back, ${userName || 'User'} (${adminRole})`;

        // RBAC UI Visibility
        if (adminRole === 'Admin') {
            document.getElementById('usersTabBtn')?.classList.remove('hidden');
            document.getElementById('analyticsTabBtn')?.classList.remove('hidden');
        }

        await loadResources(adminEmail);
    });

    const modal = document.getElementById('resourceModal');
    const resourceForm = document.getElementById('resourceForm');

    document.getElementById('addResourceBtn').addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Add New Resource';
        resourceForm.reset();
        document.getElementById('originalPostId').value = '';
        modal.classList.remove('hidden');
    });

    // Modals
    const closeResourceModal = document.getElementById('closeResourceModal');
    const closeUserModal = document.getElementById('closeUserModal');

    if (closeResourceModal) closeResourceModal.onclick = () => document.getElementById('resourceModal').classList.add('hidden');
    if (closeUserModal) closeUserModal.onclick = () => document.getElementById('userModal').classList.add('hidden');

    document.getElementById('addUserBtn')?.addEventListener('click', () => {
        document.getElementById('userForm').reset();
        document.getElementById('userModal').classList.remove('hidden');
    });

    document.getElementById('userForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
        const data = {
            action: 'upsert-user',
            adminEmail: adminEmail,
            userEmail: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value
        };

        try {
            const response = await fetch(CONFIG.BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                document.getElementById('userModal').classList.add('hidden');
                loadUsers(adminEmail);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) { console.error(error); }
    });

    resourceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);

        const data = {
            action: 'upsert-resource',
            adminEmail: adminEmail,
            postId: document.getElementById('postId').value,
            resourceName: document.getElementById('resourceName').value,
            downloadLink: document.getElementById('downloadLink').value
        };

        try {
            const response = await fetch(CONFIG.BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                modal.classList.add('hidden');
                await loadResources(adminEmail);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving resource:', error);
        }
    });
}

async function loadResources(email) {
    const tableBody = document.getElementById('resourceTableBody');
    if (!tableBody) return;

    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}?action=get-all-resources&email=${encodeURIComponent(email)}`);
        const result = await response.json();

        if (result.success) {
            tableBody.innerHTML = '';
            result.resources.forEach(res => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${res.postId}</td>
                    <td>${res.resourceName}</td>
                    <td class="link-cell">${res.downloadLink.substring(0, 30)}...</td>
                    <td class="action-btns">
                        <button class="btn-small btn-edit" style="background:var(--color-secondary)" onclick="copyResourceLink('${res.postId}', this)">Copy Link</button>
                        <button class="btn-small btn-edit" onclick="editResource('${res.postId}', '${res.resourceName}', '${res.downloadLink}')">Edit</button>
                        <button class="btn-small btn-delete" onclick="deleteResource('${res.postId}')">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            // If not an admin, redirect back
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error loading resources:', error);
    }
}

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

async function loadUsers(adminEmail) {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}?action=get-all-users&email=${encodeURIComponent(adminEmail)}`);
        const result = await response.json();

        if (result.success) {
            tableBody.innerHTML = '';
            result.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.email}</td>
                    <td><span class="role-badge badge-${user.role.toLowerCase()}">${user.role}</span></td>
                    <td class="action-btns">
                        ${!user.isHardcoded ? `<button class="btn-small btn-delete" onclick="deleteUser('${user.email}')">Remove</button>` : '<span style="color:#666">System Lock</span>'}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
    } catch (error) { console.error('Error loading users:', error); }
}

window.deleteUser = async (userEmail) => {
    if (!confirm(`Remove access for ${userEmail}?`)) return;
    const adminEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
    const response = await fetch(CONFIG.BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete-user', adminEmail, userEmail })

    });
    const result = await response.json();
    if (result.success) loadUsers(adminEmail);
};

// ============================================
// ADMIN ANALYTICS RENDERING
// ============================================

async function loadAnalytics(adminEmail) {
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}?action=get-admin-analytics&email=${encodeURIComponent(adminEmail)}`);
        const result = await response.json();

        if (result.success) {
            const stats = result.stats;
            document.getElementById('statTotalLeads').textContent = stats.totalLeads;
            document.getElementById('statTotalWaitlist').textContent = stats.totalWaitlist;
            document.getElementById('statConversionRate').textContent = stats.conversionRate + '%';

            // Simple breakdown list
            const breakdown = document.getElementById('categoryBreakdown');
            breakdown.innerHTML = '<ul style="list-style:none; padding:0;">';
            Object.entries(stats.categories).forEach(([cat, count]) => {
                const percent = ((count / stats.totalWaitlist) * 100).toFixed(1);
                breakdown.innerHTML += `
                    <li style="margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span>${cat}</span>
                            <span>${count} (${percent}%)</span>
                        </div>
                        <div style="height:8px; background:#333; border-radius:4px;">
                            <div style="height:100%; width:${percent}%; background:var(--color-primary); border-radius:4px;"></div>
                        </div>
                    </li>`;
            });
            breakdown.innerHTML += '</ul>';
        }
    } catch (error) { console.error('Error loading analytics:', error); }
}


window.editResource = (postId, name, link) => {
    document.getElementById('modalTitle').textContent = 'Edit Resource';
    document.getElementById('postId').value = postId;
    document.getElementById('resourceName').value = name;
    document.getElementById('downloadLink').value = link;
    document.getElementById('originalPostId').value = postId;
    document.getElementById('resourceModal').classList.remove('hidden');
};

window.deleteResource = async (postId) => {
    if (!confirm(`Are you sure you want to delete ${postId}?`)) return;

    const adminEmail = getFromLocalStorage(CONFIG.STORAGE_KEYS.USER_EMAIL);
    try {
        const response = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'delete-resource',
                adminEmail: adminEmail,
                postId: postId
            })
        });

        const result = await response.json();
        if (result.success) {
            await loadResources(adminEmail);
        } else {
            alert('Delete failed: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting resource:', error);
    }
};

window.copyResourceLink = (postId, btn) => {
    const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
    const fullUrl = `${baseUrl}?post=${postId}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Copied! ✅</span>';
        btn.style.background = '#10b981';

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
};
