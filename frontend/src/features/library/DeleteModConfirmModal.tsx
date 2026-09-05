import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

interface DeleteModConfirmModalProps {
  isOpen: boolean;
  modName?: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteModConfirmModal: React.FC<DeleteModConfirmModalProps> = ({
  isOpen,
  modName,
  isDeleting = false,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Delete Mod from Library?"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isDeleting}>
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-xs text-[#a1a1aa] leading-relaxed">
        Are you sure you want to delete <span className="text-[#f4f4f5] font-medium">&ldquo;{modName}&rdquo;</span> from your mod library? This action cannot be undone.
      </p>
    </Modal>
  );
};
