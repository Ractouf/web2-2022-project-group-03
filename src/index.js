import Game from './game/Game';
import menuMusic from './sounds/mainMenu.mp3';
import './stylesheets/main.css';

const main = document.querySelector('main');
const music = new Audio(menuMusic);
music.loop = true;

const showMenu = () => {
  main.innerHTML = `
        <section class="menu">
            <h1>GRIOR</h1>
            <button>PLAY</button>
            <p>ZQSD / WASD move · SPACE jump · C first person · ESC pause</p>
        </section>`;
  music.play().catch(() => { }); // blocked until the first user interaction

  main.querySelector('button').addEventListener('click', () => {
    music.pause();
    music.currentTime = 0;
    main.innerHTML = '';

    new Game(showMenu);
  });
};

showMenu();
