// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import { TAbstractFile, TFolder } from 'obsidian';
import { pathMatchesSimpleSearch } from '@utils/simple_search_filter';
import { TextInputSuggest } from './suggest';

export class FolderSuggest extends TextInputSuggest<TFolder> {
  getSuggestions(inputStr: string): TFolder[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    abstractFiles.forEach((folder: TAbstractFile) => {
      if (folder instanceof TFolder && pathMatchesSimpleSearch(folder.path, inputStr)) {
        folders.push(folder);
      }
    });

    return folders;
  }

  renderSuggestion(file: TFolder, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFolder): void {
    this.inputEl.value = file.path;
    this.inputEl.trigger('input');
    this.close();
  }
}
