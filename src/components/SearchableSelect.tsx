import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface Option {
  value: string;
  label: string;
  searchLabel?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter((o) => {
      const searchStr = o.searchLabel ? o.searchLabel.toLowerCase() : o.label.toLowerCase();
      return searchStr.includes(lowerSearch);
    });
  }, [options, search]);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            setSearch('');
          }
        }}
        className={cn(
          'w-full flex items-center justify-between bg-[#1d222a] border border-[#2b313a] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40 transition-colors text-left',
          disabled ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-gray-300 hover:border-gray-600',
          !selectedOption && 'text-gray-500'
        )}
      >
        <span className="truncate flex-1 pr-2">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-[200] top-full left-0 w-full mt-1 bg-[#1d222a] border border-[#2b313a] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center px-3 py-2 border-b border-[#2b313a]">
            <Search size={14} className="text-gray-500 mr-2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 p-0 placeholder-gray-600"
            />
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between text-left px-3 py-2 text-xs rounded-lg transition-colors',
                    option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/20 hover:text-primary',
                    option.value === value ? 'bg-primary/10 text-primary font-medium' : 'text-gray-300'
                  )}
                >
                  <span className="truncate pr-2">{option.label}</span>
                  {option.value === value && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
