document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const tableBody = document.getElementById('table-body');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    let allMessages = [];

    // Keys
    const binId = '69b2d82ac3097a1dd51cc9a9';
    const apiKey = '$2a$10$nnSfeJQZY9FjkKghjfzlPuWFrIe/JV46TLSQbnho77T3kkmx/mMvK';

    // Theme logic
    const savedTheme = localStorage.getItem('monitoring_theme') || 'dark';
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.textContent = 'Light Mode';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.textContent = 'Dark Mode';
    }

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('monitoring_theme', 'light');
            themeToggleBtn.textContent = 'Dark Mode';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('monitoring_theme', 'dark');
            themeToggleBtn.textContent = 'Light Mode';
        }
    });

    refreshBtn.addEventListener('click', fetchData);
    searchInput.addEventListener('input', updateTable);
    sortSelect.addEventListener('change', updateTable);

    fetchData();

    async function fetchData() {
        refreshBtn.textContent = 'Loading...';
        refreshBtn.disabled = true;

        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
                headers: {
                    'X-Master-Key': apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch data.');
            }

            const data = await response.json();
            
            // Assuming data structure: data.record.messages
            if (data.record && Array.isArray(data.record.messages)) {
                allMessages = data.record.messages;
                calculateStats();
                updateTable();
            } else {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No messages found or invalid structure.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: red;">Error: ${error.message}</td></tr>`;
        } finally {
            refreshBtn.textContent = 'Refresh Data';
            refreshBtn.disabled = false;
        }
    }

    function calculateStats() {
        document.getElementById('total-messages').textContent = allMessages.length;
        
        let userMsgs = 0;
        let botMsgs = 0;
        const ips = new Set();

        allMessages.forEach(msg => {
            if (msg.role === 'user') userMsgs++;
            if (msg.role === 'bot') botMsgs++;
            if (msg.ip) ips.add(msg.ip);
        });

        document.getElementById('user-messages').textContent = userMsgs;
        document.getElementById('bot-messages').textContent = botMsgs;
        document.getElementById('total-users').textContent = ips.size;
    }

    function updateTable() {
        const query = searchInput.value.toLowerCase();
        const sortOrder = sortSelect.value;

        // Filter
        let filtered = allMessages.filter(msg => {
            const textMatch = (msg.text || '').toLowerCase().includes(query);
            const ipMatch = (msg.ip || '').toLowerCase().includes(query);
            return textMatch || ipMatch;
        });

        // Sort
        filtered.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime() || 0;
            const timeB = new Date(b.timestamp).getTime() || 0;
            return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
        });

        // Render
        tableBody.innerHTML = '';
        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No messages matching your search.</td></tr>';
            return;
        }

        // Basic markdown and text formatting function
        function formatMessageText(text) {
            if (!text) return '';
            
            // 1. Escape HTML first to prevent XSS and tag breaking
            let html = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

            // 2. Bold: **text**
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            
            // 3. Italics: *text*
            html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            
            // 4. Superscript numbers: ^2, ^3 -> ², ³ or <sup>
            html = html.replace(/\^([0-9]+)/g, '<sup>$1</sup>');

            // 5. Code blocks: `code`
            html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

            return html;
        }

        filtered.forEach(msg => {
            const tr = document.createElement('tr');
            
            // Format date based on timestamp or separate date/time fields
            let displayDate = 'N/A';
            if (msg.timestamp) {
                const d = new Date(msg.timestamp);
                displayDate = d.toLocaleString();
            } else if (msg.date && msg.time) {
                displayDate = `${msg.date} ${msg.time}`;
            }

            const roleClass = msg.role === 'user' ? 'role-user' : 'role-bot';
            const displayRole = msg.role ? msg.role.toUpperCase() : 'UNKNOWN';

            // 1. Date Cell
            const dateTd = document.createElement('td');
            dateTd.textContent = displayDate;
            tr.appendChild(dateTd);

            // 2. Role Cell
            const roleTd = document.createElement('td');
            roleTd.textContent = displayRole;
            roleTd.className = roleClass;
            tr.appendChild(roleTd);

            // 3. Message Cell
            const msgTd = document.createElement('td');
            msgTd.innerHTML = formatMessageText(msg.text); // Render formatted markdown
            msgTd.className = 'message-cell'; // used for css formatting
            tr.appendChild(msgTd);

            // 4. IP Cell
            const ipTd = document.createElement('td');
            ipTd.textContent = msg.ip || 'Unknown';
            tr.appendChild(ipTd);

            tableBody.appendChild(tr);
        });
    }
});
