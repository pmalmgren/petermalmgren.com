const triggerNav = () => {
    const nav = document.getElementById('navigation');
    
    if (nav.classList.contains('hidden')) {
        nav.classList.remove('hidden');
        return;
    }

    nav.classList.add('hidden');
};
