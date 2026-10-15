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

  main.querySelector('button').addEventListener('click', startGame);
};

const showEnd = (totalTime) => {
  main.innerHTML = `
        <section class="menu end">
            <h1>THANKS FOR PLAYING</h1>
            <p>You finished in ${totalTime}s</p>
            <div class="buttons">
                <button class="again">PLAY AGAIN</button>
                <button class="to-menu">MENU</button>
            </div>
        </section>`;

  main.querySelector('.again').addEventListener('click', startGame);
  main.querySelector('.to-menu').addEventListener('click', showMenu);
};

function startGame() {
  music.pause();
  music.currentTime = 0;
  main.innerHTML = '';

  new Game((totalTime) => (totalTime === undefined ? showMenu() : showEnd(totalTime)));
}

showMenu();
