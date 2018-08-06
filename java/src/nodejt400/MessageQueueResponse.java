package nodejt400;

public class MessageQueueResponse {
	private String data;
	private MessageQ MessageQ;

	public MessageQueueResponse(String data, MessageQ MessageQ) {
		super();
		this.data = data;
		this.MessageQ = MessageQ;
	}

	public String getData() {
		return data;
	}

	// public void write(String data) throws Exception {
	// 	MessageQ.write(data);
	// }

}
