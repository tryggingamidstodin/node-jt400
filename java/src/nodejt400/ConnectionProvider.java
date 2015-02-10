package nodejt400;

import java.sql.Connection;

public interface ConnectionProvider
{
	Connection getConnection() throws Exception;

	void returnConnection(Connection c) throws Exception;

  void close();
}
