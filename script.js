document.addEventListener('DOMContentLoaded', () => {
  const PF = require('pathfinding');
  const canvas = document.getElementById('antCanvas');
  const ctx = canvas.getContext('2d');
  let currentMode = 'placingNests'; // Other modes: 'placingFood', 'placingObstacles'
  const pheromoneGrid = createPheromoneGrid(canvas.width, canvas.height);
  let foodSources = [];
  let obstacles = [];
  const ants = [];
  const nests = [];

  function resizeCanvas() {
    const controlsHeight = document.getElementById('controls').offsetHeight;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - controlsHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class AntNest {
    constructor(x, y) {
      this.position = { x, y };
      this.foodStored = 0;
    }

    draw() {
      ctx.fillStyle = 'brown';
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, 10, 0, 2 * Math.PI);
      ctx.fill();
    }

    depositFood() {
      this.foodStored++;
    }

    isNearby(position) {
      const distance = Math.sqrt(
        (this.position.x - position.x) ** 2 +
          (this.position.y - position.y) ** 2
      );
      return distance < 15;
    }

    interactWithAnt(ant) {
      if (ant.state === 'carryingFood' && this.isNearby(ant.position)) {
        this.depositFood();
        ant.state = 'searching';
      }
    }
  }

  const grid = new PF.Grid(100, 100); // Adjust the size as needed

  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    grid.setWalkableAt(obstacle.x, obstacle.y, false);
  }

  const finder = new PF.AStarFinder();

  class Ant {
    constructor(x, y, nest) {
      this.position = { x, y };
      this.velocity = { x: Math.random() - 0.5, y: Math.random() - 0.5 };
      this.nest = nest;
      this.state = 'searching';
      this.speed = 1;
    }

    findPathTo(target) {
      const path = finder.findPath(
        this.position.x,
        this.position.y,
        target.x,
        target.y,
        grid.clone()
      );
      return path;
    }

    isAtLocation(location) {
      const distance = Math.sqrt(
        (this.position.x - location.x) ** 2 +
          (this.position.y - location.y) ** 2
      );
      return distance < 5;
    }

    isNearFood() {
      for (let i = 0; i < foodSources.length; i++) {
        const food = foodSources[i];
        const distance = Math.sqrt(
          (this.position.x - food.x) ** 2 + (this.position.y - food.y) ** 2
        );
        if (distance < 5) {
          return food;
        }
      }
      return null;
    }

    isFoodNearby() {
      let nearestFood = null;
      let nearestDistance = Infinity;
      for (let i = 0; i < foodSources.length; i++) {
        const food = foodSources[i];
        const distance = Math.sqrt(
          (this.position.x - food.x) ** 2 + (this.position.y - food.y) ** 2
        );
        if (distance < 50 && distance < nearestDistance) {
          // 50 is the radius to check for food
          nearestFood = food;
          nearestDistance = distance;
        }
      }
      return nearestFood;
    }

    willCollideWithObstacle() {
      const nextPosition = {
        x: this.position.x + this.velocity.x * this.speed,
        y: this.position.y + this.velocity.y * this.speed,
      };
      for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        const distance = Math.sqrt(
          (nextPosition.x - obstacle.x) ** 2 +
            (nextPosition.y - obstacle.y) ** 2
        );
        if (distance < obstacle.size / 2) {
          return true;
        }
      }
      return false;
    }

    moveTowards(target) {
      const directionToTarget = {
        x: target.x - this.position.x,
        y: target.y - this.position.y,
      };
      const magnitude = Math.sqrt(
        directionToTarget.x ** 2 + directionToTarget.y ** 2
      );
      this.velocity.x = directionToTarget.x / magnitude;
      this.velocity.y = directionToTarget.y / magnitude;
      this.position.x += this.velocity.x * this.speed;
      this.position.y += this.velocity.y * this.speed;
    }

    avoidObstacle() {
      this.velocity.x *= -1;
      this.velocity.y *= -1;
      this.position.x += this.velocity.x * this.speed;
      this.position.y += this.velocity.y * this.speed;
    }
    updatePheromoneGrid() {
      const x = Math.floor(this.position.x);
      const y = Math.floor(this.position.y);
      if (
        x >= 0 &&
        x < pheromoneGrid.length &&
        y >= 0 &&
        y < pheromoneGrid[0].length
      ) {
        pheromoneGrid[x][y] += 1;
      }
    }

    move() {
      if (this.state === 'searching') {
        const food = this.isFoodNearby();
        if (food) {
          this.moveTowards(food);
          if (this.isAtLocation(food)) {
            this.state = 'carryingFood';
            food.amount--;
          }
        } else {
          this.followPheromoneTrail();
          this.randomWalk();
        }
      } else if (this.state === 'carryingFood') {
        if (this.isNearObstacle()) {
          this.avoidObstacle();
        } else {
          this.moveTowards(this.nest.position);
        }

        if (this.isAtLocation(this.nest.position)) {
          this.nest.depositFood();
          this.state = 'searching';
        }
      }
      // Continue with pheromone updating and bounds checking
      this.updatePheromoneGrid();
      this.checkBounds();
    }

    isNearObstacle() {
      // Check if there is an obstacle in the ant's immediate vicinity
      const lookaheadDistance = 20; // How far ahead the ant checks for obstacles
      const nextPosition = {
        x: this.position.x + this.velocity.x * lookaheadDistance,
        y: this.position.y + this.velocity.y * lookaheadDistance,
      };

      return obstacles.some((obstacle) => {
        const distance = Math.sqrt(
          Math.pow(nextPosition.x - obstacle.x, 2) +
            Math.pow(nextPosition.y - obstacle.y, 2)
        );
        return distance < obstacle.size / 2;
      });
    }

    avoidObstacle() {
      // A simple avoidance strategy that needs to be refined for your specific use case
      // The ant will turn left or right when detecting an obstacle ahead
      const turnAngle = Math.PI / 2; // Turn 90 degrees
      const turnDirection = Math.random() < 0.5 ? 1 : -1; // Randomly choose left or right

      const newVelocity = {
        x:
          this.velocity.x * Math.cos(turnAngle) -
          this.velocity.y * Math.sin(turnAngle) * turnDirection,
        y:
          this.velocity.x * Math.sin(turnAngle) +
          this.velocity.y * Math.cos(turnAngle) * turnDirection,
      };

      this.velocity = newVelocity;
      this.moveInDirection(newVelocity);
    }

    moveInDirection(direction) {
      // Move the ant in the specified direction
      const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2);
      this.velocity.x = direction.x / magnitude;
      this.velocity.y = direction.y / magnitude;
      this.position.x += this.velocity.x * this.speed;
      this.position.y += this.velocity.y * this.speed;
    }

    randomWalk() {
      this.velocity.x += (Math.random() - 0.5) * 0.05;
      this.velocity.y += (Math.random() - 0.5) * 0.05;
      this.position.x += this.velocity.x * this.speed;
      this.position.y += this.velocity.y * this.speed;
      this.checkBounds();
    }

    returnToNest() {
      const directionToNest = {
        x: this.nest.position.x - this.position.x,
        y: this.nest.position.y - this.position.y,
      };
      const magnitude = Math.sqrt(
        directionToNest.x ** 2 + directionToNest.y ** 2
      );
      this.velocity.x = directionToNest.x / magnitude;
      this.velocity.y = directionToNest.y / magnitude;
      this.position.x += this.velocity.x * this.speed;
      this.position.y += this.velocity.y * this.speed;
      if (this.isAtLocation(this.nest.position)) {
        this.state = 'searching';
      }
    }

    followPheromoneTrail() {
      let directions = [];
      let totalConcentration = 0;

      for (let angle = 0; angle < 360; angle += 30) {
        let radian = (angle * Math.PI) / 180;
        let checkPos = {
          x: this.position.x + Math.cos(radian) * 5,
          y: this.position.y + Math.sin(radian) * 5,
        };

        let concentrationAtCheckPos =
          this.getPheromoneConcentrationAt(checkPos);
        totalConcentration += concentrationAtCheckPos;
        directions.push({
          concentration: concentrationAtCheckPos,
          direction: { x: Math.cos(radian), y: Math.sin(radian) },
        });
      }

      let randomNum = Math.random() * totalConcentration;
      let cumulativeSum = 0;
      let selectedDirection = null;

      for (let i = 0; i < directions.length; i++) {
        cumulativeSum += directions[i].concentration;
        if (cumulativeSum > randomNum) {
          selectedDirection = directions[i].direction;
          break;
        }
      }

      if (selectedDirection) {
        this.position.x += selectedDirection.x * this.speed;
        this.position.y += selectedDirection.y * this.speed;
      } else {
        this.randomWalk();
      }
    }

    getPheromoneConcentrationAt(position) {
      const x = Math.floor(position.x);
      const y = Math.floor(position.y);
      if (
        x >= 0 &&
        x < pheromoneGrid.length &&
        y >= 0 &&
        y < pheromoneGrid[0].length
      ) {
        return pheromoneGrid[x][y];
      } else {
        return 0;
      }
    }

    checkBounds() {
      if (this.position.x < 0 || this.position.x > canvas.width) {
        this.velocity.x *= -1;
      }
      if (this.position.y < 0 || this.position.y > canvas.height) {
        this.velocity.y *= -1;
      }
    }

    isAtLocation(location) {
      const distance = Math.sqrt(
        (this.position.x - location.x) ** 2 +
          (this.position.y - location.y) ** 2
      );
      return distance < 5;
    }

    draw() {
      ctx.fillStyle = this.state === 'carryingFood' ? 'red' : 'black';
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function createPheromoneGrid(width, height) {
    let grid = new Array(width);
    for (let x = 0; x < width; x++) {
      grid[x] = new Array(height).fill(0);
    }
    return grid;
  }

  function placeFood(x, y) {
    foodSources.push({ x, y, amount: 100 });
  }

  function placeObstacle(x, y) {
    obstacles.push({ x, y, size: 10 });
    grid.setWalkableAt(x, y, false); // Add this line
  }

  function switchMode(newMode) {
    currentMode = newMode;
    document.querySelectorAll('#controls button').forEach((button) => {
      button.classList.toggle(
        'active',
        button.textContent === newMode.replace('placing', 'Place ')
      );
    });
  }

  window.switchMode = switchMode;

  canvas.addEventListener('click', function (event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (currentMode === 'placingNests') {
      createNest(x, y);
    } else if (currentMode === 'placingFood') {
      placeFood(x, y);
    } else if (currentMode === 'placingObstacles') {
      placeObstacle(x, y);
    }
  });

  function createNest(x, y) {
    const newNest = new AntNest(x, y);
    nests.push(newNest);
    for (let i = 0; i < 100; i++) {
      ants.push(new Ant(x, y, newNest));
    }
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    foodSources.forEach((food) => {
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.arc(food.x, food.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });

    obstacles.forEach((obstacle) => {
      ctx.fillStyle = 'gray';
      ctx.fillRect(
        obstacle.x - obstacle.size / 2,
        obstacle.y - obstacle.size / 2,
        obstacle.size,
        obstacle.size
      );
    });

    nests.forEach((nest) => {
      nest.draw();
      ants.forEach((ant) => {
        nest.interactWithAnt(ant);
      });
    });

    ants.forEach((ant) => {
      ant.move();
      ant.draw();
    });

    requestAnimationFrame(update);
  }

  update();
});
