import { supabase } from './supabase';

/**
 * Deletes files from 'mission-proofs' bucket given their public URLs.
 * Extracts the file path from the URL.
 */
export async function deleteFilesFromStorage(urls: (string | null | undefined)[]) {
    const validUrls = urls.filter(url => url && typeof url === 'string') as string[];

    if (validUrls.length === 0) return;

    // Supabase Public URL format:
    // .../storage/v1/object/public/mission-proofs/USER_ID/FILENAME
    // We need 'USER_ID/FILENAME'

    const pathsToDelete: string[] = [];
    const BUCKET_NAME = 'mission-proofs';

    validUrls.forEach(url => {
        try {
            // Find the index of the bucket name in the URL
            const bucketIndex = url.indexOf(`/${BUCKET_NAME}/`);
            if (bucketIndex !== -1) {
                // Extract everything after /mission-proofs/
                // Length of `/${BUCKET_NAME}/` is BUCKET_NAME.length + 2
                const path = url.substring(bucketIndex + BUCKET_NAME.length + 2);
                // Decode URI components in case of spaces/Korean characters
                pathsToDelete.push(decodeURIComponent(path));
            }
        } catch (e) {
            console.error("Error parsing storage URL:", url, e);
        }
    });

    if (pathsToDelete.length > 0) {
        console.log("Deleting files from storage:", pathsToDelete);
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(pathsToDelete);

        if (error) {
            console.error("Failed to delete files from storage:", error);
        } else {
            console.log("Successfully deleted files from storage.");
        }
    }
}
