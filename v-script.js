const serverInput = document.getElementById('serverFile');
const logInput = document.getElementById('logFile');
const tree = document.getElementById('tree');
const messagesEl = document.getElementById('messages');

const serverHeader = document.getElementById('serverHeader');
const serverIcon = document.getElementById('serverIcon');
const serverName = document.getElementById('serverName');

const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const themeToggle = document.getElementById('themeToggle');

const threadPanel = document.getElementById('threadPanel');
const threadTitle = document.getElementById('threadTitle');
const threadMessages = document.getElementById('threadMessages');
const threadClose = document.getElementById('threadClose');

const searchInput = document.getElementById('searchInput');
const searchIcon = document.getElementById('searchIcon');
const searchPanel = document.getElementById('searchPanel');
const searchResults = document.getElementById('searchResults');
const searchClose = document.getElementById('searchClose');
const searchHighlight = document.getElementById('searchHighlight');
const userSuggestions = document.getElementById('userSuggestions');
const datePicker = document.getElementById('datePicker');
const logFileLabel = document.getElementById('logFileLabel');

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarCloseBtn = document.getElementById('sidebarClose');
const menuToggleMobile = document.getElementById('menuToggleMobile');

let users = {};
let roles = {};
let emojis = {};
let messageData = null;
let currentChannel = null;
let currentChannelIsPrivate = false;
let selectedFiles = { server: null, messages: null };
let driveFiles = {};

/* ===== mobile sidebar toggle ===== */
function openSidebar(){
  sidebar.classList.add('active');
  sidebarOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar(){
  sidebar.classList.remove('active');
  sidebarOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

menuToggleMobile.addEventListener('click', openSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

/* ===== theme toggle ===== */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.body.setAttribute('data-theme', savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

themeToggle.addEventListener('click', () => {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', newTheme);
  // ユーザー操作時のみlocalStorageに保存
  localStorage.setItem('theme', newTheme);
});

initTheme();

function blobURL(bytes){
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

/* ===== display name ===== */
function displayName(uid){
  const u = users[uid];
  if(!u) return uid;

  const nickname = u[0];

  return nickname;
}

/* ===== mention rendering ===== */
function renderMentions(text){
  if(typeof text !== 'string') return '';

  let html = text;

  // everyone / here
  html = html.replace(/@everyone/g,
    `<span class="mention everyone">@everyone</span>`);
  html = html.replace(/@here/g,
    `<span class="mention everyone">@here</span>`);

  // role mentions
  html = html.replace(/<@&(\d+)>/g, (_, id)=>{
    const r = roles[id];
    const name = r ? r[0] : `role(${id})`;
    const color = r && r[1] ? r[1] : '#999';
    return `<span class="mention" style="background:${color}22;color:${color}">@${escapeHtml(name)}</span>`;
  });

  // user mentions
  html = html.replace(/<@!?(\d+)>/g, (_, id)=>{
    return `<span class="mention user">@${escapeHtml(displayName(id))}</span>`;
  });

  // emoji replacement
  html = html.replace(/<a?:(\w+):(\d+)>/g, (match, name, id)=>{
    const emoji = emojis[id];
    if(emoji){
      const isAnimated = emoji[2] ? '.gif' : '.png';
      const emojiUrl = blobURL(emoji[1]);
      return `<img src="${emojiUrl}" alt=":${name}:" style="height:1.25em;width:1.25em;vertical-align:middle;margin:0 2px;">`;
    }
    return match;
  });

  // URL links
  html = html.replace(/https?:\/\/[^\s<>)]+/g, (url)=>{
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
  });

  // escape and restore tags
  return escapeHtml(html)
    .replace(/&lt;span/g,'<span')
    .replace(/&lt;\/span&gt;/g,'</span>')
    .replace(/&lt;a/g,'<a')
    .replace(/&lt;\/a&gt;/g,'</a>')
    .replace(/&lt;img/g,'<img')
    .replace(/&lt;\/img&gt;/g,'</img>')
    .replace(/&gt;/g,'>');
}

/* ===== modal functions ===== */
function openImageModal(src){
  modalImage.src = src;
  imageModal.classList.add('active');
}

function closeImageModal(){
  imageModal.classList.remove('active');
  modalImage.src = '';
}

imageModal.addEventListener('click', (e)=>{
  if(e.target === imageModal){
    closeImageModal();
  }
});

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    closeImageModal();
  }
});

/* ===== load server ===== */
serverInput.addEventListener('change', async e=>{
if(!e.target.files || e.target.files.length===0) return;

  const buf = await e.target.files[0].arrayBuffer();
  const data = msgpack.decode(new Uint8Array(buf));

  users = data["Users"] || {};
  roles = data["Roles"] || {};
  emojis = data["Emojis"] || {};

  const icon = data["__server_icon__"];
  if(icon){
    serverName.textContent = icon[0];
    if(icon[2]) serverIcon.src = blobURL(icon[2]);
    serverHeader.style.display = 'flex';
    searchInput.placeholder = `${icon[0]}内を検索`;
  }

  // Start loading messages after server file is loaded
  const logFile = document.getElementById('logFile');
  logFile.disabled = false;
  logFileLabel.style.opacity = '1';
  logFileLabel.style.pointerEvents = 'auto';

  // Hide loading status
  document.getElementById('loadingStatus').style.display = 'none';
});

/* ===== load messages ===== */
logInput.addEventListener('change', async e=>{

  if(!e.target.files || e.target.files.length===0) return;
  
  // 読み込み中状態を表示
  const loadingStatus = document.getElementById('loadingStatus');
  const logFileLabel = document.getElementById('logFileLabel');
  
  loadingStatus.style.display = 'block';
  serverInput.disabled = true;
  logInput.disabled = true;
  logFileLabel.style.opacity = '0.5';
  logFileLabel.style.pointerEvents = 'none';

  const buf = await e.target.files[0].arrayBuffer();

  try {
    messageData = msgpack.decode(new Uint8Array(buf));
    buildTree();
    // 読み込み完了後、検索窓を表示
    const searchBarContainer = document.getElementById('searchBarContainer');
    searchBarContainer.style.display = 'flex';
    loadingStatus.style.display = 'none';
    
    // controlsを非表示にして再読み込みボタンを表示
    document.getElementById('localControls').style.display = 'none';
    document.getElementById('reloadBtn').style.display = 'block';
  } catch(error) {
    console.error('メッセージ読み込みエラー:', error);
    alert('メッセージファイルの読み込みに失敗しました');
    loadingStatus.style.display = 'none';
  } finally {
    serverInput.disabled = false;
    console.log(serverInput.disabled);
    logInput.disabled = false;
    logFileLabel.style.opacity = '1';
    logFileLabel.style.pointerEvents = 'auto';
  }
});

/* ===== reload function ===== */
function resetViewer(){
  // データをクリア
  users = {};
  roles = {};
  emojis = {};
  messageData = null;
  currentChannel = null;
  currentChannelIsPrivate = false;
  
  // UIをリセット
  tree.innerHTML = '';
  messagesEl.innerHTML = '';
  searchResults.innerHTML = '';
  threadMessages.innerHTML = '';
  
  // パネルを閉じる
  threadPanel.classList.remove('active');
  searchPanel.classList.remove('active');
  
  // サーバーヘッダーを非表示
  serverHeader.style.display = 'none';
  serverName.textContent = '';
  serverIcon.src = '';
  
  // 検索バーを非表示
  document.getElementById('searchBarContainer').style.display = 'none';
  searchInput.value = '';
  updateSearchHighlight();
  userSuggestions.style.display = 'none';
  
  // タイトルをリセット
  document.getElementById('roomTitle').textContent = '未選択';
  
  // ファイル入力をリセット
  serverInput.value = '';
  logInput.value = '';
  logInput.disabled = true;
  document.getElementById('logFileLabel').style.opacity = '0.5';
  document.getElementById('logFileLabel').style.pointerEvents = 'none';
  
  // controlsを表示、再読み込みボタンを非表示
  document.getElementById('localControls').style.display = 'block';
  document.getElementById('reloadBtn').style.display = 'none';
}

document.getElementById('reloadBtn').addEventListener('click', resetViewer);

/* ===== tree ===== */
function buildTree(){
  tree.innerHTML='';
  for(const cat in messageData){
    const li=document.createElement('li');

    const title=document.createElement('div');
    title.className='cat-title';
    title.textContent=cat;

    const ul=document.createElement('ul');
    ul.className='channels';

    title.onclick=()=>ul.style.display=ul.style.display?'':'block';

    for(const ch in messageData[cat]){
      const channelLi = document.createElement('li');
      channelLi.id = `channel-${cat}-${ch}`;
      
      const c=document.createElement('div');
      c.className='channel';
      const channelData = messageData[cat][ch];
      const isPrivate = channelData.private === true;
      
      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'channel-icon-wrapper';
      iconWrapper.textContent = isPrivate ? '🔒' : '';
      
      const content = document.createElement('span');
      content.className = 'channel-content';
      content.textContent = '# ' + ch;
      
      c.appendChild(iconWrapper);
      c.appendChild(content);
      c.onclick=(e)=>{
        renderChannel(e,cat,ch,channelData);
        showThreadsForChannel(channelLi, channelData, cat, ch);
      };
      
      channelLi.appendChild(c);
      ul.appendChild(channelLi);
    }

    li.append(title,ul);
    tree.appendChild(li);
  }
}

/* ===== show threads for selected channel ===== */
function showThreadsForChannel(channelLi, channelData, cat, ch){
  console.log('showThreadsForChannel called', {channelLi, channelData, cat, ch});
  
  // Remove all existing thread lists
  document.querySelectorAll('.threads').forEach(el=>el.remove());
  
  // Add threads for this channel only
  if(channelData.threads && Object.keys(channelData.threads).length > 0){
    console.log('Threads found:', Object.keys(channelData.threads));
    
    const threadsUl = document.createElement('ul');
    threadsUl.className = 'threads';
    threadsUl.style.display = 'block'; // Force display
    
    for(const threadName in channelData.threads){
      const threadLi = document.createElement('li');
      threadLi.className = 'thread';
      threadLi.textContent = '💬 ' + threadName;
      threadLi.onclick = (e)=>{
        e.stopPropagation();
        renderThread(e, cat, ch, threadName, channelData.threads[threadName]);
      };
      threadsUl.appendChild(threadLi);
    }
    
    channelLi.appendChild(threadsUl);
    console.log('Threads list appended to channelLi');
  } else {
    console.log('No threads found for this channel');
  }
}

/* ===== create reply block ===== */
function createReplyBlock(m, msgs){
  if(!m.reply_to || !msgs[m.reply_to]) return null;
  
  const repliedMsg = msgs[m.reply_to];
  const replyDiv = document.createElement('div');
  replyDiv.className = 'reply-block';
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'reply-block-header';
  
  const line = document.createElement('div');
  line.className = 'line';
  headerDiv.appendChild(line);
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'reply-block-content';
  
  // Add avatar
  const repliedUser = users[repliedMsg.author_id];
  if(repliedUser && repliedUser[2]){
    const avatarImg = document.createElement('img');
    avatarImg.className = 'reply-avatar';
    avatarImg.src = blobURL(repliedUser[2]);
    contentDiv.appendChild(avatarImg);
  }
  
  const repliedAuthorName = displayName(repliedMsg.author_id);
  
  // Determine reply preview text
  let repliedContent = '';
  if(repliedMsg.text){
    repliedContent = repliedMsg.text.substring(0, 100).replace(/\n/g, ' ');
  } else if(repliedMsg.attachments){
    repliedContent = '添付ファイル';
  } else {
    repliedContent = '';
  }
  
  const textSpan = document.createElement('span');
  textSpan.innerHTML = `${escapeHtml(repliedAuthorName)}: ${escapeHtml(repliedContent)}${(repliedMsg.text || '').length > 100 ? '...' : ''}`;
  contentDiv.appendChild(textSpan);
  
  replyDiv.appendChild(headerDiv);
  replyDiv.appendChild(contentDiv);
  
  replyDiv.onclick = ()=>{
    const replyElement = document.querySelector(`[data-msg-id="${m.reply_to}"]`);
    if(replyElement){
      replyElement.scrollIntoView({behavior: 'smooth', block: 'center'});
      replyElement.style.backgroundColor = 'var(--selected)';
      setTimeout(()=>{ replyElement.style.backgroundColor = ''; }, 2000);
    }
  };
  
  return replyDiv;
}

/* ===== create message avatar ===== */
function createAvatar(m, isFirst){
  const av = document.createElement('div');
  av.className = 'msg-side';
  
  if(isFirst){
    const u = users[m.author_id];
    if(u && u[2]){
      const img = document.createElement('img');
      img.src = blobURL(u[2]);
      av.appendChild(img);
    }
  } else {
    const timeStr = new Date(m.ts*1000).toLocaleTimeString('ja-JP', {minute:'2-digit', second:'2-digit'});
    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = timeStr;
    av.appendChild(timeEl);
  }
  
  return av;
}

/* ===== create message header ===== */
function createMessageHeader(m){
  const header = document.createElement('div');
  header.className = 'msg-header';
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'msg-header-name';
  nameSpan.textContent = displayName(m.author_id);
  
  const u = users[m.author_id];
  if(u && u[3]){
    nameSpan.style.color = u[3];
  }
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'msg-header-time';
  timeSpan.textContent = '・ ' + new Date(m.ts*1000).toLocaleString();
  
  header.appendChild(nameSpan);
  header.appendChild(timeSpan);
  
  return header;
}

/* ===== create message content ===== */
function createMessageContent(m){
  const cont = document.createElement('div');
  cont.className = 'content';
  
  if(m.type==='text'){
    // Text content
    if(m.text){
      // Check if text is only emojis (30 or less)
      const emojiOnlyMatch = m.text.match(/<a?:\w+:\d+>|[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu);
      const isEmojiOnly = emojiOnlyMatch && emojiOnlyMatch.length <= 30 && m.text.replace(/<a?:\w+:\d+>|[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim() === '';
      
      const textDiv = document.createElement('div');
      if(isEmojiOnly){
        textDiv.style.fontSize = '3em';
        textDiv.style.lineHeight = '1.2';
      }
      textDiv.innerHTML = renderMentions(m.text);
      cont.appendChild(textDiv);
    }
    
    // Attachments
    if(m.attachments){
      const attachmentsDiv = document.createElement('div');
      attachmentsDiv.style.marginTop = '8px';
      
      for(const a of m.attachments){
        if(a.content_type && a.content_type.startsWith('image')){
          const img = document.createElement('img');
          img.style.cursor = 'zoom-in';
          img.src = blobURL(a.data);
          img.addEventListener('click', ()=>openImageModal(img.src));
          attachmentsDiv.appendChild(img);
        } else {
          const d = document.createElement('div');
          d.style.marginTop = '4px';
          const link = document.createElement('a');
          link.href = blobURL(a.data);
          link.download = a.filename;
          link.textContent = `📄 ${a.filename}`;
          link.style.textDecoration = 'underline';
          link.style.cursor = 'pointer';
          d.appendChild(link);
          attachmentsDiv.appendChild(d);
        }
      }
      
      cont.appendChild(attachmentsDiv);
    }
  } else if(m.type==='poll'){
    // Poll text (if any)
    if(m.text){
      const textDiv = document.createElement('div');
      textDiv.innerHTML = renderMentions(m.text);
      cont.appendChild(textDiv);
    }
    
    const pollDiv = document.createElement('div');
    pollDiv.className = 'poll';
    
    const question = document.createElement('div');
    question.className = 'poll-question';
    question.textContent = m.poll.question;
    pollDiv.appendChild(question);
    
    const totalVotes = m.poll.answers.reduce((sum, ans) => sum + ans.votes, 0);
    
    for(const answer of m.poll.answers){
      const answerDiv = document.createElement('div');
      answerDiv.className = 'poll-answer';
      
      const barDiv = document.createElement('div');
      barDiv.className = 'poll-answer-bar';
      const percentage = totalVotes > 0 ? (answer.votes / totalVotes * 100) : 0;
      barDiv.style.width = percentage + '%';
      answerDiv.appendChild(barDiv);
      
      const answerText = document.createElement('div');
      answerText.className = 'poll-answer-text';
      answerText.textContent = answer.text;
      
      const answerVotes = document.createElement('div');
      answerVotes.className = 'poll-answer-votes';
      answerVotes.textContent = `${answer.votes}票 ${Math.round(percentage)}%`;
      
      answerDiv.appendChild(answerText);
      answerDiv.appendChild(answerVotes);
      pollDiv.appendChild(answerDiv);
    }
    
    cont.appendChild(pollDiv);
  }
  
  return cont;
}

/* ===== render message group ===== */
function renderMessageGroup(messages, msgs, container, messageIds = null, includeThreadLink = false, channelData = null, cat = null, ch = null){
  for(let i = 0; i < messages.length; i++){
    const m = messages[i];
    const isFirst = i === 0;
    
    const div = document.createElement('div');
    div.className = 'msg-container ' + (isFirst ? 'group-start' : 'group-item');
    
    // Set message ID for navigation
    if(messageIds && messageIds[i]){
      div.setAttribute('data-msg-id', messageIds[i]);
    }
    
    // Add reply block
    if(isFirst && msgs){
      const replyDiv = createReplyBlock(m, msgs);
      if(replyDiv) div.appendChild(replyDiv);
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-content-wrapper';
    
    const av = createAvatar(m, isFirst);
    const body = document.createElement('div');
    
    if(isFirst){
      body.appendChild(createMessageHeader(m));
    }
    
    const cont = createMessageContent(m);
    body.appendChild(cont);
    
    // Add thread link
    if(includeThreadLink && isFirst && m.thread_title && channelData && channelData.threads && channelData.threads[m.thread_title]){
      const threadLink = document.createElement('div');
      threadLink.style.marginTop = '8px';
      threadLink.style.padding = '8px';
      threadLink.style.background = 'var(--panel)';
      threadLink.style.borderRadius = '6px';
      threadLink.style.cursor = 'pointer';
      threadLink.style.fontSize = '13px';
      threadLink.style.color = 'var(--text-2)';
      threadLink.innerHTML = `💬 スレッド: ${escapeHtml(m.thread_title)}`;
      threadLink.onclick = ()=>{
        renderThread({currentTarget: document.querySelector(`.thread`)}, cat, ch, m.thread_title, channelData.threads[m.thread_title]);
        document.querySelectorAll('.thread').forEach(el=>{
          if(el.textContent === '💬 ' + m.thread_title){
            el.classList.add('selected');
          }
        });
      };
      threadLink.onmouseover = ()=>threadLink.style.background = 'var(--hover)';
      threadLink.onmouseout = ()=>threadLink.style.background = 'var(--panel)';
      body.appendChild(threadLink);
    }
    
    wrapper.append(av, body);
    div.appendChild(wrapper);
    container.appendChild(div);
  }
}

/* ===== render thread ===== */
function renderThread(ev, cat, ch, threadName, threadMsgs){
  document.querySelectorAll('.thread').forEach(el=>el.classList.remove('selected'));
  ev.currentTarget.classList.add('selected');

  // Close sidebar on mobile after selection
  if(window.innerWidth <= 768){
    closeSidebar();
  }

  threadMessages.innerHTML='';
  threadTitle.textContent=`💬 ${threadName}`;
  threadPanel.classList.add('active');

  const threadIds = Object.keys(threadMsgs).sort((a,b)=>threadMsgs[a].ts-threadMsgs[b].ts);
  
  // Group thread messages
  const threadGroups = [];
  let threadGroup = null;
  let threadGroupIds = [];
  
  for(const mid of threadIds){
    const m = threadMsgs[mid];
    if(!threadGroup || 
       threadGroup[0].author_id !== m.author_id || 
       (m.ts - threadGroup[threadGroup.length-1].ts) > 7*60){
      if(threadGroup){
        threadGroups.push({messages: threadGroup, ids: threadGroupIds});
      }
      threadGroup = [m];
      threadGroupIds = [mid];
    } else {
      threadGroup.push(m);
      threadGroupIds.push(mid);
    }
  }
  if(threadGroup){
    threadGroups.push({messages: threadGroup, ids: threadGroupIds});
  }
  
  // Render thread messages
  for(const tgroup of threadGroups){
    const tgroupDiv = document.createElement('div');
    tgroupDiv.className = 'msg-group';
    renderMessageGroup(tgroup.messages, threadMsgs, tgroupDiv, tgroup.ids);
    threadMessages.appendChild(tgroupDiv);
  }
}

/* ===== render channel ===== */
function renderChannel(ev,cat,ch,data){
  document.querySelectorAll('.channel').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll('.thread').forEach(el=>el.classList.remove('selected'));
  ev.currentTarget.classList.add('selected');

  // Close sidebar on mobile after selection
  if(window.innerWidth <= 768){
    closeSidebar();
  }

  messagesEl.innerHTML='';
  const roomTitle = document.getElementById('roomTitle');
  roomTitle.innerHTML = '';
  
  const isPrivate = data.private === true;
  currentChannelIsPrivate = isPrivate;
  
  const iconSpan = document.createElement('span');
  iconSpan.className = 'topbar-icon';
  iconSpan.textContent = isPrivate ? '🔒#' : '#';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = ch;
  
  roomTitle.appendChild(iconSpan);
  roomTitle.appendChild(nameSpan);
  
  currentChannel = data;

  const msgs = data.messages;
  const ids = Object.keys(msgs).sort((a,b)=>msgs[a].ts-msgs[b].ts);

  // Group messages by author and time
  const groups = [];
  let currentGroup = null;
  let currentGroupIds = [];

  for(const mid of ids){
    const m = msgs[mid];

    if(!currentGroup || 
       currentGroup[0].author_id !== m.author_id || 
       (m.ts - currentGroup[currentGroup.length-1].ts) > 7*60 ||
       m.reply_to){
      if(currentGroup){
        groups.push({messages: currentGroup, ids: currentGroupIds});
      }
      currentGroup = [m];
      currentGroupIds = [mid];
    } else {
      currentGroup.push(m);
      currentGroupIds.push(mid);
    }
  }
  if(currentGroup){
    groups.push({messages: currentGroup, ids: currentGroupIds});
  }

  // Render grouped messages
  for(const group of groups){
    const groupDiv = document.createElement('div');
    groupDiv.className = 'msg-group';
    renderMessageGroup(group.messages, msgs, groupDiv, group.ids, true, data, cat, ch);
    messagesEl.appendChild(groupDiv);
  }
}

/* ===== check if message is a reply target ===== */
function isReplyTarget(msgId, msgs){
  for(const id in msgs){
    if(msgs[id].reply_to === msgId){
      return true;
    }
  }
  return false;
}

threadClose.addEventListener('click', (e)=>{
  e.stopPropagation();
  threadPanel.classList.remove('active');
  document.querySelectorAll('.thread').forEach(el=>el.classList.remove('selected'));
});

/* ===== parse search query (Discord-like syntax) ===== */
function parseSearchQuery(query){
  const filters = {
    text: [],
    from: [],
    in: [],
    before: [],
    after: [],
    during: []
  };
  
  const parts = query.match(/(\w+:"[^"]*"|[^"\s]+)/g) || [];
  
  for(const part of parts){
    if(part.includes(':')){
      const colonIndex = part.indexOf(':');
      const key = part.slice(0, colonIndex);
      const value = part.slice(colonIndex + 1).replace(/"/g, '').toLowerCase();
      
      if(key === 'from'){
        filters.from.push(value);
      } else if(key === 'in'){
        filters.in.push(value);
      } else if(key === 'before'){
        filters.before.push(new Date(value).getTime() / 1000);
      } else if(key === 'after'){
        filters.after.push(new Date(value).getTime() / 1000);
      } else if(key === 'during'){
        filters.during.push(new Date(value).getTime() / 1000);
      } else {
        filters.text.push(part.toLowerCase());
      }
    } else {
      filters.text.push(part.toLowerCase());
    }
  }
  
  return filters;
}

/* ===== search function (Discord-like) ===== */
function searchMessages(query){
  if(!messageData || !query.trim()){
    searchPanel.classList.remove('active');
    document.getElementById('searchBarContainer').classList.remove('active');
    searchIcon.textContent = '🔍';
    searchIcon.classList.remove('closable');
    return;
  }
  
  const filters = parseSearchQuery(query);
  const results = [];
  
  // Search through all categories and channels
  for(const cat in messageData){
    for(const ch in messageData[cat]){
      const channelData = messageData[cat][ch];
      const msgs = channelData.messages;
      
      // Check 'in:' filter (OR within same tag)
      if(filters.in.length > 0){
        const inMatch = filters.in.some(inVal => ch.toLowerCase().includes(inVal));
        if(!inMatch) continue;
      }
      
      for(const msgId in msgs){
        const m = msgs[msgId];
        let matchAll = true;
        
        // Check 'from:' filter (OR within same tag)
        if(filters.from.length > 0){
          const fromMatch = filters.from.some(fromVal => 
            displayName(m.author_id).toLowerCase().includes(fromVal)
          );
          if(!fromMatch) matchAll = false;
        }
        
        // Check 'before:' filter (OR within same tag - most recent of the conditions)
        if(matchAll && filters.before.length > 0){
          const beforeMatch = filters.before.some(beforeVal => m.ts <= beforeVal);
          if(!beforeMatch) matchAll = false;
        }
        
        // Check 'after:' filter (OR within same tag - oldest of the conditions)
        if(matchAll && filters.after.length > 0){
          const afterMatch = filters.after.some(afterVal => m.ts >= afterVal);
          if(!afterMatch) matchAll = false;
        }
        
        // Check 'during:' filter (same day)
        if(matchAll && filters.during.length > 0){
          const duringMatch = filters.during.some(duringVal => {
            const msgDate = new Date(m.ts * 1000);
            const targetDate = new Date(duringVal * 1000);
            return msgDate.toDateString() === targetDate.toDateString();
          });
          if(!duringMatch) matchAll = false;
        }
        
        // Check text filters (OR within text, all text terms must be present)
        if(matchAll && filters.text.length > 0){
          const messageText = (m.text || '').toLowerCase();
          matchAll = filters.text.every(t => messageText.includes(t));
        }
        
        if(matchAll){
          results.push({
            category: cat,
            channel: ch,
            msgId: msgId,
            message: m,
            channelData: channelData
          });
        }
      }
    }
  }
  
  // Sort results by timestamp (newest first)
  results.sort((a, b) => b.message.ts - a.message.ts);
  
  // Display results in search panel
  searchResults.innerHTML = '';
  searchPanel.classList.add('active');
  document.getElementById('searchBarContainer').classList.add('active');
  searchIcon.textContent = '✕';
  searchIcon.classList.add('closable');
  
  if(results.length === 0){
    document.getElementById('searchPanelTitle').textContent = '検索結果：0件';
    const noResults = document.createElement('div');
    noResults.style.padding = '12px';
    noResults.style.color = 'var(--text-2)';
    noResults.textContent = '検索結果がありません';
    searchResults.appendChild(noResults);
    return;
  }
  
  // Update title with result count
  document.getElementById('searchPanelTitle').textContent = `検索結果：${results.length}件`;
  
  // Render results (newest first, ungrouped for faster access)
  for(const result of results){
    const m = result.message;
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'search-result-item';
    resultDiv.style.padding = '8px 12px';
    resultDiv.style.borderBottom = '1px solid var(--panel-hover)';
    resultDiv.style.cursor = 'pointer';
    resultDiv.style.transition = 'background 0.2s';
    
    // Channel header
    const channelDiv = document.createElement('div');
    channelDiv.style.fontSize = '11px';
    channelDiv.style.color = 'var(--text-2)';
    channelDiv.style.marginBottom = '4px';
    channelDiv.innerHTML = `# ${escapeHtml(result.channel)} • ${new Date(m.ts * 1000).toLocaleDateString('ja-JP')}`;
    resultDiv.appendChild(channelDiv);
    
    // Message content
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-content-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';
    
    // Avatar
    const av = document.createElement('div');
    av.className = 'msg-side';
    const u = users[m.author_id];
    if(u && u[2]){
      const img = document.createElement('img');
      img.src = blobURL(u[2]);
      img.style.width = '32px';
      img.style.height = '32px';
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      av.appendChild(img);
    }
    
    // Body
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.minWidth = '0';
    
    // Header
    const header = document.createElement('div');
    header.className = 'msg-header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'msg-header-name';
    nameSpan.textContent = displayName(m.author_id);
    const u_user = users[m.author_id];
    if(u_user && u_user[3]){
      nameSpan.style.color = u_user[3];
    }
    header.appendChild(nameSpan);
    body.appendChild(header);
    
    // Message text (preview)
    const textPreview = document.createElement('div');
    textPreview.style.marginTop = '2px';
    textPreview.style.color = 'var(--text)';
    textPreview.style.whiteSpace = 'pre-wrap';
    textPreview.style.wordBreak = 'break-word';
    textPreview.style.display = '-webkit-box';
    textPreview.style.webkitLineClamp = '3';
    textPreview.style.webkitBoxOrient = 'vertical';
    textPreview.style.overflow = 'hidden';
    if(m.text){
      // Apply renderMentions first, then highlight search terms
      let previewText = m.text.substring(0, 200);
      let renderedText = renderMentions(previewText);
      
      // Highlight search terms
      if(filters.text.length > 0){
        const searchPattern = filters.text.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        renderedText = renderedText.replace(
          new RegExp(`(${searchPattern})`, 'gi'),
          '<mark style="background:rgba(255,193,7,0.4); padding:2px 4px; border-radius:2px;">$1</mark>'
        );
      }
      
      textPreview.innerHTML = renderedText + (m.text.length > 200 ? '...' : '');
    } else if(m.attachments){
      textPreview.textContent = '📎 添付ファイル';
    }
    body.appendChild(textPreview);
    
    // Add image preview if attachments exist
    if(m.attachments && m.attachments.length > 0){
      const firstImage = m.attachments.find(a => a.content_type && a.content_type.startsWith('image'));
      if(firstImage){
        const previewImg = document.createElement('img');
        previewImg.className = 'search-result-preview-image';
        previewImg.src = blobURL(firstImage.data);
        body.appendChild(previewImg);
      }
    }
    
    wrapper.appendChild(av);
    wrapper.appendChild(body);
    resultDiv.appendChild(wrapper);
    
    // Click to jump to message
    resultDiv.addEventListener('click', ()=>{
      renderChannel({currentTarget: {classList: {remove: ()=>{}, add: ()=>{}}}}, result.category, result.channel, result.channelData);
      
      setTimeout(()=>{
        const messageElement = document.querySelector(`[data-msg-id="${result.msgId}"]`);
        if(messageElement){
          messageElement.scrollIntoView({behavior: 'smooth', block: 'center'});
          messageElement.style.animation = 'pulse 0.6s ease-out';
        }
      }, 100);
    });
    
    resultDiv.addEventListener('mouseover', ()=>{
      resultDiv.style.background = 'var(--hover)';
    });
    resultDiv.addEventListener('mouseout', ()=>{
      resultDiv.style.background = 'transparent';
    });
    
    searchResults.appendChild(resultDiv);
  }
}

/* ===== search input highlight ===== */
function updateSearchHighlight(){
  const text = searchInput.value;
  const regex = /\b(from|in|before|after|during):[^\s]*/g;
  
  let highlightedText = text.replace(regex, (match) => {
    return `<mark>${match}</mark>`;
  });
  
  searchHighlight.innerHTML = highlightedText;
}
searchInput.addEventListener('input', updateSearchHighlight);
searchInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    e.preventDefault();
    searchMessages(searchInput.value);
  }
});

/* ===== user suggestions ===== */
function filterUsersByQuery(query){
  const q = query.toLowerCase();
  return Object.entries(users)
    .filter(([id,u])=>{
      const name = (u?.[0] || '').toLowerCase();
      return name.includes(q);
    })
    .slice(0,50)
    .map(([id,u])=>({id,name:u?.[0]||id,avatar:u?.[2]}));
}

function renderUserSuggestions(query){
  const matches = filterUsersByQuery(query);
  if(matches.length===0){
    userSuggestions.style.display='none';
    userSuggestions.innerHTML='';
    return;
  }
  userSuggestions.innerHTML='';
  matches.forEach(m=>{
    const item=document.createElement('div');
    item.className='user-suggestion';
    if(m.avatar){
      const img=document.createElement('img');
      img.src=blobURL(m.avatar);
      item.appendChild(img);
    }else{
      const placeholder=document.createElement('div');
      placeholder.className='user-suggestion-placeholder';
      item.appendChild(placeholder);
    }
    const nameSpan=document.createElement('span');
    nameSpan.className='user-suggestion-name';
    nameSpan.textContent=m.name;
    item.appendChild(nameSpan);
    item.onclick=()=>{
      const text=searchInput.value;
      const replaced=text.replace(/from:"?[^"\s]*"?$/i, `from:"${m.name}" `);
      searchInput.value=replaced;
      updateSearchHighlight();
      userSuggestions.style.display='none';
      searchInput.focus();
    };
    userSuggestions.appendChild(item);
  });
  userSuggestions.style.display='block';
}

function handleUserSuggestion(){
  const caretPos=searchInput.selectionStart;
  const textBefore=searchInput.value.slice(0,caretPos);
  const match=textBefore.match(/from:"?([^"\s]*)?$/i);
  if(match && match[1]!==undefined){
    renderUserSuggestions(match[1]);
  }else if(textBefore.endsWith('from:')){
    renderUserSuggestions('');
  }else{
    userSuggestions.style.display='none';
  }
}

/* ===== channel suggestions ===== */
function filterChannelsByQuery(query){
  const q = query.toLowerCase();
  const channels = [];
  
  for(const cat in messageData){
    for(const ch in messageData[cat]){
      if(ch.toLowerCase().includes(q)){
        channels.push({category: cat, name: ch});
      }
    }
  }
  
  return channels.slice(0, 50);
}

function renderChannelSuggestions(query){
  const matches = filterChannelsByQuery(query);
  if(matches.length === 0){
    userSuggestions.style.display = 'none';
    userSuggestions.innerHTML = '';
    return;
  }
  userSuggestions.innerHTML = '';
  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'user-suggestion';
    
    const iconSpan = document.createElement('span');
    iconSpan.textContent = '#';
    iconSpan.style.fontSize = '18px';
    iconSpan.style.color = 'var(--text-2)';
    item.appendChild(iconSpan);
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-suggestion-name';
    nameSpan.textContent = m.name;
    item.appendChild(nameSpan);
    
    item.onclick = () => {
      const text = searchInput.value;
      const replaced = text.replace(/in:"?[^"\s]*"?$/i, `in:"${m.name}" `);
      searchInput.value = replaced;
      updateSearchHighlight();
      userSuggestions.style.display = 'none';
      searchInput.focus();
    };
    userSuggestions.appendChild(item);
  });
  userSuggestions.style.display = 'block';
}

/* ===== date picker ===== */
let currentPickerDate = new Date();
let currentPickerType = '';

function renderDatePicker(type){
  currentPickerType = type;
  datePicker.innerHTML = '';
  
  const header = document.createElement('div');
  header.className = 'date-picker-header';
  
  const prevBtn = document.createElement('div');
  prevBtn.className = 'date-picker-nav';
  prevBtn.textContent = '◀';
  prevBtn.onclick = () => {
    currentPickerDate.setMonth(currentPickerDate.getMonth() - 1);
    renderDatePicker(type);
  };
  
  const title = document.createElement('div');
  title.className = 'date-picker-title';
  title.textContent = `${currentPickerDate.getFullYear()}年 ${currentPickerDate.getMonth() + 1}月`;
  
  const nextBtn = document.createElement('div');
  nextBtn.className = 'date-picker-nav';
  nextBtn.textContent = '▶';
  nextBtn.onclick = () => {
    currentPickerDate.setMonth(currentPickerDate.getMonth() + 1);
    renderDatePicker(type);
  };
  
  header.appendChild(prevBtn);
  header.appendChild(title);
  header.appendChild(nextBtn);
  datePicker.appendChild(header);
  
  // Weekdays
  const weekdays = document.createElement('div');
  weekdays.className = 'date-picker-weekdays';
  ['日', '月', '火', '水', '木', '金', '土'].forEach(day => {
    const weekday = document.createElement('div');
    weekday.className = 'date-picker-weekday';
    weekday.textContent = day;
    weekdays.appendChild(weekday);
  });
  datePicker.appendChild(weekdays);
  
  // Days
  const days = document.createElement('div');
  days.className = 'date-picker-days';
  
  const year = currentPickerDate.getFullYear();
  const month = currentPickerDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const today = new Date();
  
  // Previous month days
  for(let i = firstDay - 1; i >= 0; i--){
    const day = document.createElement('div');
    day.className = 'date-picker-day other-month';
    day.textContent = daysInPrevMonth - i;
    days.appendChild(day);
  }
  
  // Current month days
  for(let i = 1; i <= daysInMonth; i++){
    const day = document.createElement('div');
    day.className = 'date-picker-day';
    day.textContent = i;
    
    const date = new Date(year, month, i);
    if(date.toDateString() === today.toDateString()){
      day.classList.add('today');
    }
    
    day.onclick = () => {
      const selectedDate = new Date(year, month, i);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const text = searchInput.value;
      const regex = new RegExp(`${type}:"?[^"\\s]*"?$`, 'i');
      const replaced = text.replace(regex, `${type}:${dateStr} `);
      searchInput.value = replaced;
      updateSearchHighlight();
      datePicker.style.display = 'none';
      searchInput.focus();
    };
    
    days.appendChild(day);
  }
  
  // Next month days
  const remainingDays = 42 - (firstDay + daysInMonth);
  for(let i = 1; i <= remainingDays; i++){
    const day = document.createElement('div');
    day.className = 'date-picker-day other-month';
    day.textContent = i;
    days.appendChild(day);
  }
  
  datePicker.appendChild(days);
  datePicker.style.display = 'block';
}

function handleSuggestions(){
  const caretPos = searchInput.selectionStart;
  const textBefore = searchInput.value.slice(0, caretPos);
  
  // Check for from: suggestions
  const fromMatch = textBefore.match(/from:"?([^"\s]*)?$/i);
  if(fromMatch && fromMatch[1] !== undefined){
    renderUserSuggestions(fromMatch[1]);
    datePicker.style.display = 'none';
    return;
  } else if(textBefore.endsWith('from:')){
    renderUserSuggestions('');
    datePicker.style.display = 'none';
    return;
  }
  
  // Check for in: suggestions
  const inMatch = textBefore.match(/in:"?([^"\s]*)?$/i);
  if(inMatch && inMatch[1] !== undefined){
    renderChannelSuggestions(inMatch[1]);
    datePicker.style.display = 'none';
    return;
  } else if(textBefore.endsWith('in:')){
    renderChannelSuggestions('');
    datePicker.style.display = 'none';
    return;
  }
  
  // Check for date filters
  const dateMatch = textBefore.match(/(before|after|during):$/i);
  if(dateMatch){
    currentPickerDate = new Date();
    renderDatePicker(dateMatch[1].toLowerCase());
    userSuggestions.style.display = 'none';
    return;
  }
  
  userSuggestions.style.display = 'none';
  datePicker.style.display = 'none';
}

/* ===== event listeners ===== */
searchInput.addEventListener('input', ()=>{
  updateSearchHighlight();
  handleSuggestions();
  if(searchInput.value === ''){
    searchIcon.textContent = '🔍';
    searchIcon.classList.remove('closable');
    searchPanel.classList.remove('active');
    document.getElementById('searchBarContainer').classList.remove('active');
  }
});
searchInput.addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){
    e.preventDefault();
    userSuggestions.style.display='none';
    datePicker.style.display='none';
    searchMessages(searchInput.value);
  }
});
document.addEventListener('click', (e)=>{
  if(!userSuggestions.contains(e.target) && !datePicker.contains(e.target) && e.target!==searchInput){
    userSuggestions.style.display='none';
    datePicker.style.display='none';
  }
});

// Search icon click functionality
searchIcon.addEventListener('click', (e)=>{
  e.stopPropagation();
  console.log('Search icon clicked:', searchIcon.textContent === '✕');
  if(searchIcon.textContent === '✕'){
    searchInput.value = '';
    updateSearchHighlight();
    searchPanel.classList.remove('active');
    document.getElementById('searchBarContainer').classList.remove('active');
    searchIcon.textContent = '🔍';
    searchIcon.classList.remove('closable');
    userSuggestions.style.display = 'none';
    datePicker.style.display = 'none';
  }
});

// Search panel close button
document.getElementById('searchPanelClose').addEventListener('click', (e)=>{
  e.stopPropagation();
  searchInput.value = '';
  updateSearchHighlight();
  searchPanel.classList.remove('active');
  document.getElementById('searchBarContainer').classList.remove('active');
  searchIcon.textContent = '🔍';
  searchIcon.classList.remove('closable');
  userSuggestions.style.display = 'none';
  datePicker.style.display = 'none';
});
