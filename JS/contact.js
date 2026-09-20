document.addEventListener("componentsLoaded", () => {
    const form = document.querySelector("#velnox-contact-form");
    const status = document.querySelector("#contact-status");
    const button = document.querySelector("#contact-submit");
    if (!form || !status || !button) return;
    const API = window.VELNOX_API || "";
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        button.disabled = true;
        button.querySelector("span").textContent = "Sending...";
        status.textContent = "";
        const data = Object.fromEntries(new FormData(form).entries());
        try {
            const response = await fetch(`${API}/api/enquiries`, {
                method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || "Unable to send enquiry.");
            status.textContent = "✓ Thanks! Your enquiry has been submitted.";
            form.reset();
        } catch (error) {
            status.textContent = `Unable to send right now. ${error.message}`;
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent = "Send Enquiry";
        }
    });
});