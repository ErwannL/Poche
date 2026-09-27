import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderUi } from '../test/render';
import { AttachmentList } from './AttachmentList';

const blob = new Blob(['x']);

describe('AttachmentList', () => {
  it('renders nothing when empty', () => {
    const { container } = renderUi(<AttachmentList attachments={[]} onRemove={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows thumbnails and removes items', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const onRemove = vi.fn();
    const { container, unmount } = renderUi(
      <AttachmentList
        onRemove={onRemove}
        attachments={[
          { id: '1', name: 'a.jpg', type: 'image/jpeg', kind: 'image', blob },
          { id: '2', name: 'memo.webm', type: 'audio/webm', kind: 'audio', blob },
          { id: '3', name: 'doc.pdf', type: 'application/pdf', kind: 'file', blob },
        ]}
      />,
    );
    expect(screen.getByRole('list', { name: 'Pièces jointes' })).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:mock');
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer memo.webm' }));
    expect(onRemove).toHaveBeenCalledWith('2');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:mock');
  });
});
