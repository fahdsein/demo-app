const form = document.querySelector('#meme-form');
const submitButton = document.querySelector('#submit-button');
const refreshButton = document.querySelector('#refresh-button');
const statusElement = document.querySelector('#status');
const gallery = document.querySelector('#gallery');

function setStatus(message, kind = '') {
  statusElement.textContent = message;
  statusElement.className = `status ${kind}`.trim();
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return body;
}

function createMemeCard(meme) {
  const card = document.createElement('article');
  card.className = 'meme-card';

  if (meme.image_url) {
    const image = document.createElement('img');
    image.src = meme.image_url;
    image.alt = `Generated ${meme.template_name} meme`;
    image.loading = 'lazy';
    card.appendChild(image);
  }

  const content = document.createElement('div');
  content.className = 'meme-card-content';

  const title = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = meme.template_name;
  title.append(strong);

  const state = document.createElement('p');
  state.textContent = `Status: ${meme.status}`;
  content.append(title, state);
  card.appendChild(content);
  return card;
}

async function loadMemes() {
  refreshButton.disabled = true;
  try {
    const memes = await requestJson('/api/memes');
    gallery.replaceChildren();
    if (memes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No memes have been generated yet.';
      gallery.appendChild(empty);
      return;
    }
    gallery.append(...memes.map(createMemeCard));
  } catch (error) {
    gallery.replaceChildren();
    const message = document.createElement('p');
    message.className = 'status error';
    message.textContent = error.message;
    gallery.appendChild(message);
  } finally {
    refreshButton.disabled = false;
  }
}

async function waitForCompletion(memeId, timeoutMilliseconds = 30000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const meme = await requestJson(`/api/memes/${memeId}`);
    if (meme.status === 'COMPLETED' || meme.status === 'FAILED' || meme.status === 'QUEUE_FAILED') {
      return meme;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Generation is still running. Refresh the feed to check again.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus('Queueing generation…');

  const formData = new FormData(form);
  const payload = {
    templateName: formData.get('templateName'),
    topText: formData.get('topText'),
    bottomText: formData.get('bottomText')
  };

  try {
    const queued = await requestJson('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setStatus('Generation queued. Waiting for the worker…');
    const completed = await waitForCompletion(queued.memeId);
    if (completed.status !== 'COMPLETED') {
      throw new Error('The worker could not generate this meme.');
    }
    setStatus('Meme generated successfully.', 'success');
    form.reset();
    await loadMemes();
  } catch (error) {
    setStatus(error.message, 'error');
    await loadMemes();
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener('click', loadMemes);
loadMemes();
