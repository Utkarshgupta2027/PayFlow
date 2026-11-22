package payment_system_backend.dto;

import java.util.List;

public class OfflineSyncResponse {

    private int totalSubmitted;
    private int settledCount;
    private int rejectedCount;
    private int duplicateCount;
    private List<TokenResult> results;

    public static class TokenResult {
        private String tokenId;
        private String status; // SETTLED, REJECTED, DUPLICATE
        private String reason;

        public TokenResult() {}

        public TokenResult(String tokenId, String status, String reason) {
            this.tokenId = tokenId;
            this.status = status;
            this.reason = reason;
        }

        public String getTokenId() { return tokenId; }
        public void setTokenId(String tokenId) { this.tokenId = tokenId; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    public OfflineSyncResponse() {}

    public OfflineSyncResponse(int totalSubmitted, int settledCount, int rejectedCount, int duplicateCount, List<TokenResult> results) {
        this.totalSubmitted = totalSubmitted;
        this.settledCount = settledCount;
        this.rejectedCount = rejectedCount;
        this.duplicateCount = duplicateCount;
        this.results = results;
    }

    public int getTotalSubmitted() { return totalSubmitted; }
    public void setTotalSubmitted(int totalSubmitted) { this.totalSubmitted = totalSubmitted; }

    public int getSettledCount() { return settledCount; }
    public void setSettledCount(int settledCount) { this.settledCount = settledCount; }

    public int getRejectedCount() { return rejectedCount; }
    public void setRejectedCount(int rejectedCount) { this.rejectedCount = rejectedCount; }

    public int getDuplicateCount() { return duplicateCount; }
    public void setDuplicateCount(int duplicateCount) { this.duplicateCount = duplicateCount; }

    public List<TokenResult> getResults() { return results; }
    public void setResults(List<TokenResult> results) { this.results = results; }
}

