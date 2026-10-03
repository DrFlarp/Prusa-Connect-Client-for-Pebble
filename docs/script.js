/**
 * Prusa Connect for Pebble - Wiki Documentation Script
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            let text = '';
            
            if (targetId) {
                const el = document.getElementById(targetId);
                text = el ? el.textContent.trim() : '';
            } else {
                text = btn.getAttribute('data-copy') || '';
            }

            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    });

    // 2. Active Sidebar Navigation on Scroll
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (!id) return;
                
                document.querySelectorAll('.sidebar-link').forEach(link => {
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        });
    }, {
        rootMargin: '0px 0px -70% 0px'
    });

    document.querySelectorAll('section[id]').forEach(section => {
        observer.observe(section);
    });
});
