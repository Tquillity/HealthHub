'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface SafeDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  description?: string;
}

export function SafeDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  description,
}: SafeDeleteModalProps) {
  const [verificationText, setVerificationText] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Reset verification when modal opens/closes or itemName changes
  useEffect(() => {
    if (isOpen) {
      setVerificationText('');
      setIsVerified(false);
    }
  }, [isOpen, itemName]);

  // Check if verification text matches itemName exactly
  useEffect(() => {
    setIsVerified(verificationText.trim() === itemName.trim());
  }, [verificationText, itemName]);

  const handleClose = () => {
    setVerificationText('');
    setIsVerified(false);
    onClose();
  };

  const handleConfirm = () => {
    if (isVerified) {
      onConfirm();
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-500">
                {description || 'This action cannot be undone.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">&quot;{itemName}&quot;</span>?
          </p>
          <p className="mt-3 text-sm font-medium text-gray-900">
            To confirm, type the name exactly: <span className="font-semibold text-red-600">&quot;{itemName}&quot;</span>
          </p>
          <div className="mt-3">
            <label htmlFor="delete-verification" className="sr-only">
              Type the recipe name to confirm deletion
            </label>
            <Input
              id="delete-verification"
              type="text"
              value={verificationText}
              onChange={(e) => setVerificationText(e.target.value)}
              placeholder={`Type "${itemName}" to confirm`}
              className="w-full"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isVerified}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

