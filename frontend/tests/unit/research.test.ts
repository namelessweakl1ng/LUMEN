import { describe, expect, it } from 'vitest';
import { emptyWorkspace, parseImport, exportMarkdown, addBookmark } from '@/lib/research/model';
describe('research data boundary', () => {
 it('round trips bounded plain data',()=>{const data=addBookmark(emptyWorkspace(),{title:'Example',url:'https://example.com/',snippet:'text',category:'general'},'query');expect(parseImport(JSON.stringify(data))).toEqual(data);expect(exportMarkdown(data)).toContain('https://example.com/');});
 it('rejects executable URLs and dangling collections',()=>{const data=addBookmark(emptyWorkspace(),{title:'Example',url:'https://example.com',snippet:'',category:'general'}); data.bookmarks[0].url='javascript:alert(1)';expect(()=>parseImport(JSON.stringify(data))).toThrow(); data.bookmarks[0].url='https://example.com';data.bookmarks[0].collectionId='missing';expect(()=>parseImport(JSON.stringify(data))).toThrow();});
 it('bounds imports and escapes Markdown HTML',()=>{expect(()=>parseImport('x'.repeat(2_000_001))).toThrow();const data=addBookmark(emptyWorkspace(),{title:'<script>bad</script>',url:'https://example.com',snippet:'',category:'general'});expect(exportMarkdown(data)).not.toContain('<script>');});
 it('deduplicates a URL within the same collection',()=>{const item={title:'A',url:'https://example.com',snippet:'',category:'general'};const data=addBookmark(emptyWorkspace(),item);expect(addBookmark(data,item).bookmarks).toHaveLength(1);});
});
