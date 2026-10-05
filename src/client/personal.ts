export const initPersonalDialog = (dialog: HTMLDialogElement): void => {
  const form = dialog.querySelector<HTMLFormElement>('#personal-state-form');
  if (!form) return;
  const field = (name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
    form.querySelector(`[data-personal-field="${name}"]`)!;
  const open = (): void => { if (!dialog.open) dialog.showModal(); };

  document.querySelectorAll<HTMLButtonElement>('[data-action="add-personal"]').forEach(button => {
    button.addEventListener('click', () => {
      form.reset();
      form.action = dialog.dataset.createAction ?? form.action;
      (field('date') as HTMLInputElement).value = dialog.dataset.today ?? '';
      field('platform').value = '';
      field('state').value = '';
      field('rating').value = '';
      field('note').value = '';
      dialog.querySelector<HTMLElement>('[data-personal-dialog-title]')!.textContent = 'Add personal entry';
      form.querySelector<HTMLButtonElement>('[data-personal-submit]')!.textContent = 'Add entry';
      open();
      field('date').focus();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="edit-personal"]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.entryId;
      if (!id) return;
      form.action = `${dialog.dataset.createAction}/${id}`;
      (field('date') as HTMLInputElement).value = button.dataset.entryDate ?? '';
      field('platform').value = button.dataset.entryPlatform ?? '';
      field('state').value = button.dataset.entryState ?? '';
      field('rating').value = button.dataset.entryRating ?? '';
      field('note').value = button.dataset.entryNote ?? '';
      dialog.querySelector<HTMLElement>('[data-personal-dialog-title]')!.textContent = `Edit entry from ${button.dataset.entryDate ?? ''}`;
      form.querySelector<HTMLButtonElement>('[data-personal-submit]')!.textContent = 'Save changes';
      open();
      field('date').focus();
    });
  });

  dialog.querySelectorAll<HTMLButtonElement>('[data-action="close-personal"]').forEach(button =>
    button.addEventListener('click', () => dialog.close()),
  );
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  if (dialog.dataset.open === 'true') open();
};
