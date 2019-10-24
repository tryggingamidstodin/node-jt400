package nodejt400;

import java.sql.Connection;
import java.util.Arrays;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.IFSFile;
import com.ibm.as400.access.IFSFileInputStream;

public class IfsReadStream {

	private ConnectionProvider connectionProvider;
	private final Connection connection;
	private int bufferSize = 10000;
	byte[] buffer = new byte[bufferSize];
	private final IFSFileInputStream fis;

	public IfsReadStream(ConnectionProvider connectionProvider, String fileName)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
		AS400 as400 = handle.getSystem();
		IFSFile file = new IFSFile(as400, fileName);
		fis = new IFSFileInputStream(file);
	}

	public byte[] read() throws Exception {
		int n = fis.read(buffer);
		if (n == -1) {
			fis.close();
			connectionProvider.returnConnection(connection);
			return null;
		} else if (n < bufferSize) {
			return Arrays.copyOf(buffer, n);
		}
		return buffer;

	}
}
