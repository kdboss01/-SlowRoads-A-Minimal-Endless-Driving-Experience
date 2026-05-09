# 🛣️ SlowRoads

SlowRoads is a procedural driving simulation game built entirely in React using the HTML5 Canvas API and Web Audio API. It offers a relaxing yet engaging driving experience with realistic physics, dynamic environments, and an immersive sound engine.

## 🚀 Features

- **Procedural Road Generation:** Experience an endless, winding road that adapts as you drive.
- **Realistic Driving Physics:** Features acceleration, deceleration, air resistance (friction), and a gear system (Neutral, Drive, Reverse).
- **Dynamic Environments:** 
  - **Time of Day:** Dynamic day/night cycle including sunset and sunrise effects.
  - **Terrain:** Different terrain types (e.g., Hills).
- **Immersive Audio Engine:** 
  - Procedural engine sounds that respond to speed and acceleration.
  - Simulated wind noise for higher speeds.
- **Game Mechanics:**
  - **Boost System:** Use speed boosts to accelerate rapidly.
  - **Scoring:** Tracks your distance and overtakes.
  - **Screen Shake:** Realistic camera movement during high speeds and collisions.
- **Customizable Settings:** Fine-tune your driving experience via an intuitive settings panel.

## 🛠️ Tech Stack

- **Frontend:** [React.js](https://reactjs.org/)
- **Graphics:** HTML5 Canvas API (2D Context)
- **Audio:** Web Audio API
- **Icons:** [Lucide React](https://lucide.dev/)
- **Styling:** CSS3

## 📁 Project Structure

```text
🛣️ SlowRoads/
├── App.js                 # Main game component & logic
├── App.css                # Game UI styling
├── index.js               # Entry point for React
├── App.test.js            # Basic test suite
├── report/                # Project documentation & reports
│   ├── Minor_II_SlowRoads.docx
│   ├── Testing.pdf
│   └── ... (scripts and other docs)
└── README.md              # Project overview
```

## 🚦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd slowroads
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## 🎮 How to Play

- **W / Arrow Up:** Accelerate
- **S / Arrow Down:** Brake / Reverse
- **A / Arrow Left:** Turn Left
- **D / Arrow Right:** Turn Right
- **Shift:** Boost
- **Settings Icon:** Toggle the settings panel to change time of day and terrain.

## 📝 About the Project

This project was developed as part of a **Minor II Project**. Detailed documentation, including requirement analysis, literature survey, and testing results, can be found in the `report/` directory.

---
*Created by Krishna Shrivastava https://github.com/kdboss01*
