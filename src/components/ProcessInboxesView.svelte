<script>
  import { onMount } from 'svelte';
  import { openFile, countLinesInFile } from '../utils';

  export let plugin;
  export let filePath;

  let lineCount = 0;

  async function updateLineCount() {
    const file = await openFile(filePath, plugin);
    lineCount = await countLinesInFile(plugin, file);
  }

  onMount(() => {
    updateLineCount();
    const interval = setInterval(updateLineCount, 1000);

    return () => {
      clearInterval(interval);
    };
  });
</script>

<div>
  <p>Inbox file: {filePath}</p>
  <p>Lines in inbox: {lineCount}</p>
</div>

