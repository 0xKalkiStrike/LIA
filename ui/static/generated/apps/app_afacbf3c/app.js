document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    const actionBtn = document.getElementById('action-btn');
    const resetBtn = document.getElementById('reset-btn');
    const output = document.getElementById('output-box');

    actionBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) {
            output.innerHTML = '<span style="color:#ef4444;">⚠️ Please type an input string first.</span>';
            return;
        }
        output.innerHTML = `<strong>Result:</strong> Successfully processed "<em>${val}</em>" at ${new Date().toLocaleTimeString()}. Status: OK.`;
    });

    resetBtn.addEventListener('click', () => {
        input.value = '';
        output.innerHTML = '<span class="placeholder">Status: Reset complete. Ready for new input.</span>';
    });
});