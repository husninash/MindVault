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

    const friendNodes = this.data.nodes.filter(n => n.type === 'friend');
    const topicNodes = this.data.nodes.filter(n => n.type === 'topic');

    let friendCount = 0;
    let topicCount = 0;

    this.nodes = this.data.nodes.map((node) => {
      let x, y, radius, color, scoreLabel = '';

      if (node.type === 'user') {
        x = centerX;
        y = centerY;
        radius = 30;
        color = '#EA8DB6';
      } else if (node.type === 'friend') {
        const totalF = Math.max(friendNodes.length, 1);
        const angle = (friendCount / totalF) * Math.PI * 2 - Math.PI / 2;
        friendCount++;

        const score = node.score !== undefined ? node.score : 80;
        scoreLabel = `${score}%`;

        // INTIMACY DISTANCE FORMULA:
        // High Intimacy (80-100%) -> Very close to user center (0.18 - 0.22 * minDimension)
        // Medium Intimacy (50-79%) -> Middle orbit (0.28 - 0.34 * minDimension)
        // Low / Conflict Intimacy (10-49%) -> Far outer orbit / drifting away (0.42 - 0.46 * minDimension)
        const minDim = Math.min(width, height);
        const normalizedIntimacy = Math.max(0.1, Math.min(1.0, score / 100)); // 0.1 to 1.0
        
        // Closer distance for higher intimacy
        const dist = minDim * (0.45 - (normalizedIntimacy * 0.25));

        x = centerX + Math.cos(angle) * dist;
        y = centerY + Math.sin(angle) * dist;

        // Node size based on intimacy
        radius = Math.round(18 + normalizedIntimacy * 8); // 19px for low score up to 26px for close friends

        // Visual Color Coding:
        // High (Green/Purple gradient), Medium (Yellow/Amber), Conflict/Low (Crimson Red)
        if (score <= 45) {
          color = '#EF4444'; // Red for conflict / needs repair
        } else if (score <= 65) {
          color = '#F59E0B'; // Amber for cooling down
        } else {
          color = '#8B5CF6'; // Purple for close friendship
        }
      } else {
        const totalT = Math.max(topicNodes.length, 1);
        const angle = (topicCount / totalT) * Math.PI * 2;
        topicCount++;
        const dist = Math.min(width, height) * 0.44;
        x = centerX + Math.cos(angle) * dist;
        y = centerY + Math.sin(angle) * dist;
        radius = 16;
        color = '#059669';
      }

      return {
        ...node,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius,
        color,
        scoreLabel
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
        if (dist <= node.radius + 6) {
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

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);

    // Draw Orbit Circles (Intimacy Tiers)
    this.ctx.save();
    this.ctx.setLineDash([4, 6]);
    this.ctx.strokeStyle = 'rgba(234, 141, 182, 0.2)';
    this.ctx.lineWidth = 1;
    
    // Close Circle Orbit
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, minDim * 0.20, 0, Math.PI * 2);
    this.ctx.stroke();

    // Medium Orbit
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, minDim * 0.32, 0, Math.PI * 2);
    this.ctx.stroke();

    // Outer / Low Orbit
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, minDim * 0.44, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // Update node positions subtly (floating animation)
    for (const node of this.nodes) {
      if (node.type !== 'user') {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce back if drifting too far
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        if (Math.hypot(dx, dy) > minDim * 0.48) {
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
        
        let strokeColor = 'rgba(200, 180, 210, 0.35)';
        let lineWidth = 1.5;

        if (edge.score !== undefined) {
          if (edge.score <= 45) {
            strokeColor = isHighlighted ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.35)';
          } else if (edge.score <= 65) {
            strokeColor = isHighlighted ? 'rgba(245, 158, 11, 0.9)' : 'rgba(245, 158, 11, 0.35)';
          } else {
            strokeColor = isHighlighted ? 'rgba(139, 92, 246, 0.9)' : 'rgba(139, 92, 246, 0.35)';
          }
          lineWidth = Math.max(1.2, (edge.score / 100) * 3);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.strokeStyle = isHighlighted ? 'rgba(234, 141, 182, 0.9)' : strokeColor;
        this.ctx.lineWidth = isHighlighted ? 3 : lineWidth;
        this.ctx.stroke();

        // Edge label if hovered
        if (isHighlighted && edge.label) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          this.ctx.fillStyle = '#2D1A29';
          this.ctx.font = '700 11px Plus Jakarta Sans';
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

      // Intimacy Percentage Badge inside Node if Friend
      if (node.type === 'friend' && node.score !== undefined) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '800 10px Plus Jakarta Sans';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${node.score}%`, node.x, node.y);
      }

      // Node Label
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillStyle = isHovered ? '#EA8DB6' : '#2D1A29';
      this.ctx.font = isHovered ? '700 13px Plus Jakarta Sans' : '600 12px Plus Jakarta Sans';
      this.ctx.textAlign = 'center';
      
      let displayLabel = node.label;
      if (node.type === 'friend' && node.score <= 45) {
        displayLabel = `⚠️ ${node.label}`;
      }
      this.ctx.fillText(displayLabel, node.x, node.y + node.radius + 16);
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}
