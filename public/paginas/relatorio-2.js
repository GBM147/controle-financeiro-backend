    // --- PARTÍCULAS DOURADAS GBM ---
    (function() {
        const canvas = document.getElementById('particles-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function Particle() {
            this.x = Math.random() * canvas.width;
            this.y = canvas.height + Math.random() * 100;
            this.size = Math.random() * 2.5 + 0.8;
            this.speedY = Math.random() * 1.2 + 0.3;
            this.opacity = Math.random() * 0.4 + 0.2;
        }
        Particle.prototype.update = function() {
            this.y -= this.speedY;
            if (this.y < -10) {
                this.y = canvas.height + 10;
                this.x = Math.random() * canvas.width;
                this.opacity = Math.random() * 0.4 + 0.2;
            }
        };
        Particle.prototype.draw = function() {
            ctx.fillStyle = `rgba(200, 159, 83, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        };

        const count = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 15000), 65);
        for (let i = 0; i < count; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animate);
        }
        animate();
    })();
