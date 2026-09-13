async function showGraph(graphId, btn) {
  // highlight buttons
  const buttonWrap = btn.closest('.button-container');
  buttonWrap.querySelectorAll('.graph-button').forEach((button) => {
    if (button.dataset.graph === graphId) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });

  // show/hide graphs
  showDaGraph(graphId, btn);
  await sleep(500);
  showDaGraph(graphId, btn);
}

function showDaGraph(graphId, btn) {
  const container = btn.closest('.graph-button-container');
  container.querySelectorAll('.graph').forEach((graph) => {
    if (graph.id === graphId) {
      graph.style.display = 'flex';           // was 'block' earlier; your first ones used flex
      graph.style.width = '99.9%';
      setTimeout(() => { graph.style.width = '100%'; }, 50);

      const interval = setInterval(triggerWindowResize, 100);
      setTimeout(() => {
        clearInterval(interval);
        const chartContainer = graph.querySelector('.chart-container');
        if (chartContainer) {
          chartContainer.style.width = '100%';
          chartContainer.style.height = '100%';
        }
      }, 1000);
    } else {
      graph.style.display = 'none';
    }
  });
}


const toggleButton = document.getElementById('toggle-nav');
const navBar = document.querySelector('.collapsible-nav');

toggleButton.addEventListener('click', () => {
    // Toggle the expanded class
    navBar.classList.toggle('expanded');

    // Update the arrow direction
    if (navBar.classList.contains('expanded')) {
        toggleButton.innerHTML = '\u25C0'; // Change arrow to point left
        navBar.style.width = '200px'; // Expanded width
    } else {
        toggleButton.innerHTML = '▶'; // Change arrow to point right
        navBar.style.width = '50px'; // Collapsed width
    }
});
// Trigger a resize event on the window
function triggerWindowResize() {
}

