// MindVault Interactive Canvas Knowledge Graph
class KnowledgeGraphEngine {
  constructor(canvasId, data) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = data;
    this.nodes = [];
    this.edges = data.edges;
    this.hoveredNode = null;
    this.selectedNode = null;
    this.animationId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Position nodes in radial cluster
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    this.nodes = this.data.nodes.map((node, index) => {
      let x, y, radius, color;

      if (node.type === 'user') {
        x = centerX;
        y = centerY;
        radius = 28;
        color = '#EA8DB6';
      } else if (node.type === 'friend') {
        const angle = ((index - 1) / 4) * Math.PI * 2;
        const dist = Math.min(width, height) * 0.28;
        x = centerX + Math.cos(angle) * dist;
        y = centerY + Math.sin(angle) * dist;
        radius = 22;
        color = '#9333EA';
      } else {
        const angle = (index / 10) * Math.PI * 2 + 0.5;
        const dist = Math.min(width, height) * 0.42;
        x = centerX + Math.cos(angle) * dist;
        y = centerY + Math.sin(angle) * dist;
        radius = 16;
        color = '#059669';
      }

      return {
        ...node,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius,
        color
      };
    });

    this.setupEvents();
    this.animate();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth || 800;
      this.canvas.height = 480;
    }
  }

  setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = null;
      for (const node of this.nodes) {
        const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
        if (dist <= node.radius + 4) {
          found = node;
          break;
        }
      }

      this.hoveredNode = found;
      this.canvas.style.cursor = found ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredNode) {
        this.selectedNode = this.hoveredNode;
        if (window.onGraphNodeClick) {
          window.onGraphNodeClick(this.hoveredNode);
        }
      }
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update node positions subtly (floating animation)
    for (const node of this.nodes) {
      if (node.type !== 'user') {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce back if drifting too far
        const dx = node.x - this.canvas.width / 2;
        const dy = node.y - this.canvas.height / 2;
        if (Math.hypot(dx, dy) > Math.min(this.canvas.width, this.canvas.height) * 0.45) {
          node.vx *= -1;
          node.vy *= -1;
        }
      }
    }

    // Draw Edges
    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.from);
      const target = this.nodes.find(n => n.id === edge.to);

      if (source && target) {
        const isHighlighted = (this.hoveredNode && (this.hoveredNode.id === source.id || this.hoveredNode.id === target.id));
        this.ctx.beginPath();
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.strokeStyle = isHighlighted ? 'rgba(234, 141, 182, 0.9)' : 'rgba(200, 180, 210, 0.35)';
        this.ctx.lineWidth = isHighlighted ? 3 : 1.5;
        this.ctx.stroke();

        // Edge label if hovered
        if (isHighlighted) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          this.ctx.fillStyle = '#2D1A29';
          this.ctx.font = '600 11px Plus Jakarta Sans';
          this.ctx.fillText(edge.label, midX, midY - 6);
        }
      }
    }

    // Draw Nodes
    for (const node of this.nodes) {
      const isHovered = this.hoveredNode === node;

      // Glow effect
      if (isHovered) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(248, 187, 217, 0.4)';
        this.ctx.fill();
      }

      // Outer Circle
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = node.color;
      this.ctx.fill();
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.stroke();

      // Node Label
      this.ctx.fillStyle = isHovered ? '#EA8DB6' : '#2D1A29';
      this.ctx.font = isHovered ? '700 13px Plus Jakarta Sans' : '600 12px Plus Jakarta Sans';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.label, node.x, node.y + node.radius + 16);
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}
